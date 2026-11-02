import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'

import { Connections } from './connections/service.js'
import { internalApp } from './internal.js'

let connections: Connections

beforeEach(async () => {
  connections = new Connections({ dir: await mkdtemp(path.join(tmpdir(), 'internal-')) })
})

describe('internal app (the AI tools)', () => {
  it('refuses requests without the right token', async () => {
    const app = internalApp(connections, 'secret-token')
    const status = async (auth?: string) =>
      (
        await (auth
          ? request(app).get('/internal/connections').set('Authorization', auth)
          : request(app).get('/internal/connections'))
      ).status
    expect(await status()).toBe(401)
    expect(await status('Bearer nope')).toBe(401)
    expect(await status('secret-token')).toBe(401)
    expect(await status('Bearer secret-token')).toBe(200)
  })

  it('answers with the token, and reads nothing when nothing is connected', async () => {
    const app = internalApp(connections, 'secret-token')
    const auth = { Authorization: 'Bearer secret-token' }
    expect((await request(app).get('/internal/connections').set(auth).expect(200)).body).toEqual([])
    expect((await request(app).get('/internal/messages').set(auth).expect(200)).body).toEqual({ items: [], failed: [] })
    await request(app).get('/internal/events?from=x&to=y').set(auth).expect(400)
    await request(app).get('/internal/nope').set(auth).expect(404)
  })
})

describe('google sign-in state', () => {
  const google = { clientId: 'id', clientSecret: 's', redirectUri: 'https://zync.test/cb' }

  it('only comes back to an app page, with a state used once', async () => {
    const c = new Connections({ dir: await mkdtemp(path.join(tmpdir(), 'g-')), google })
    expect(() => c.googleStart('https://evil.test')).toThrow(/page of the app/)
    expect(() => c.googleStart('//evil.test/w/x')).toThrow(/page of the app/)
    const url = new URL(c.googleStart('/w/perso/settings'))
    expect(url.searchParams.get('scope')).toContain('gmail.readonly')
    const state = url.searchParams.get('state') ?? ''
    // Refused by the user: back to the page with the reason, and the state is spent.
    expect(await c.googleFinish({ state, error: 'access_denied' })).toEqual({
      back: '/w/perso/settings',
      error: 'Google access was refused',
    })
    await expect(c.googleFinish({ state, code: 'x' })).rejects.toMatchObject({ status: 400 })
    await expect(c.googleFinish({ state: 'forged', code: 'x' })).rejects.toMatchObject({ status: 400 })
  })

  it('says Google is not set up without a client', async () => {
    const c = new Connections({ dir: await mkdtemp(path.join(tmpdir(), 'g-')) })
    expect(c.available().google).toBe(false)
    expect(() => c.googleStart('/w/perso/settings')).toThrow(/GOOGLE_CLIENT_ID/)
  })
})
