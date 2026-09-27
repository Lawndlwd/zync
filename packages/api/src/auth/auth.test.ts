import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { createApp } from '../app.js'
import { authConfig } from './config.js'
import { check } from './guard.js'
import { Auth } from './service.js'
import { AuthStore } from './store.js'
import type { Webauthn } from './webauthn.js'

const HOST = 'zync.test'
const ORIGIN = `https://${HOST}`

// A fake authenticator: a response "signs" the challenge by carrying it as clientDataJSON.
const fakeWebauthn: Webauthn = {
  registrationOptions: async (_user, _exclude, challenge) => ({
    challenge,
    rp: { name: 'zync' },
    user: { id: 'u', name: 'owner', displayName: 'owner' },
    pubKeyCredParams: [],
  }),
  authenticationOptions: async (challenge) => ({ challenge }),
  verifyRegistration: async (r, challenge) =>
    r.response.clientDataJSON === challenge
      ? { id: r.id, publicKey: 'pk', counter: 0, transports: ['internal'] }
      : null,
  verifyAuthentication: async (r, challenge, cred) =>
    r.response.clientDataJSON === challenge && r.id === cred.id ? cred.counter + 1 : null,
}
const registration = (id: string, challenge: string) => ({
  response: { id, rawId: id, type: 'public-key', response: { clientDataJSON: challenge, attestationObject: 'x' } },
})
const assertion = (id: string, challenge: string) => ({
  response: {
    id,
    rawId: id,
    type: 'public-key',
    response: { clientDataJSON: challenge, authenticatorData: 'a', signature: 's' },
  },
})

let now: number
let dir: string
let auth: Auth
let app: ReturnType<typeof createApp>
let alerts: ReturnType<typeof vi.fn<(title: string, message: string) => void>>

beforeEach(async () => {
  now = 1_000_000
  dir = await mkdtemp(path.join(tmpdir(), 'zync-auth-'))
  alerts = vi.fn<(title: string, message: string) => void>()
  auth = new Auth(authConfig(ORIGIN, path.join(dir, 'auth')), { webauthn: fakeWebauthn, alert: alerts, now: () => now })
  app = createApp({ workspacesRoot: dir, auth })
})

/** Cookies set by a response, as a Cookie header value. */
const setCookies = (res: request.Response): string[] => {
  const raw: unknown = res.headers['set-cookie']
  const list: unknown[] = Array.isArray(raw) ? raw : [raw]
  return list.filter((c): c is string => typeof c === 'string')
}
const cookiesOf = (res: request.Response) =>
  setCookies(res)
    .map((c) => c.split(';')[0] ?? '')
    .filter((c) => c !== '' && !c.endsWith('='))

const get = (url: string, cookies: string[] = []) => request(app).get(url).set('Host', HOST).set('Cookie', cookies)
const post = (url: string, body: object = {}, cookies: string[] = []) =>
  request(app).post(url).set('Host', HOST).set('Origin', ORIGIN).set('Cookie', cookies).send(body)

/** Set up with the setup code and one passkey; returns the session cookie. */
async function setUp(credId = 'cred-1'): Promise<{ session: string[]; recoveryCodes: string[] }> {
  const code = await auth.newSetupCode()
  const opts = await post('/zync/api/auth/setup/options', { code })
  expect(opts.status).toBe(200)
  const verify = await post(
    '/zync/api/auth/setup/verify',
    { ...registration(credId, opts.body.challenge), name: 'Laptop' },
    cookiesOf(opts),
  )
  expect(verify.status).toBe(201)
  return { session: cookiesOf(verify), recoveryCodes: verify.body.recoveryCodes }
}

async function signIn(credId = 'cred-1', cookies: string[] = []) {
  const opts = await post('/zync/api/auth/login/options', {}, cookies)
  return post('/zync/api/auth/login/verify', assertion(credId, opts.body.challenge), [...cookies, ...cookiesOf(opts)])
}

describe('the gate', () => {
  it('lets nothing through without a session', async () => {
    expect((await get('/zync/api/workspaces')).status).toBe(401)
    expect((await get('/some/opencode/path')).status).toBe(401)
  })

  it('sends a page visit to the sign-in page, and back afterwards', async () => {
    const res = await get('/w/notes/files?x=1')
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/login?next=%2Fw%2Fnotes%2Ffiles%3Fx%3D1')
  })

  it('refuses another Host even with a valid session (DNS rebinding)', async () => {
    const { session } = await setUp()
    const res = await request(app).get('/zync/api/workspaces').set('Host', 'evil.test').set('Cookie', session)
    expect(res.status).toBe(421)
  })

  it('answers the container health check on any host', async () => {
    expect((await request(app).get('/zync/api/health').set('Host', 'localhost:3001')).body).toEqual({ ok: true })
  })

  it('refuses cross-site and cross-origin requests (CSRF)', async () => {
    const { session } = await setUp()
    expect((await get('/zync/api/workspaces', session).set('Sec-Fetch-Site', 'cross-site')).status).toBe(403)
    const noOrigin = await request(app).post('/zync/api/workspaces').set('Host', HOST).set('Cookie', session).send({})
    expect(noOrigin.status).toBe(403)
    const otherOrigin = await post('/zync/api/workspaces', { name: 'x' }, session).set('Origin', 'https://evil.test')
    expect(otherOrigin.status).toBe(403)
  })

  it('lets a link from elsewhere open a page', async () => {
    const res = await get('/w/notes')
      .set('Sec-Fetch-Site', 'cross-site')
      .set('Sec-Fetch-Mode', 'navigate')
      .set('Sec-Fetch-Dest', 'document')
    expect(res.status).toBe(302)
  })

  it('refuses WebSocket upgrades without a session or from another origin', async () => {
    const { session } = await setUp()
    const headers = { host: HOST, origin: ORIGIN, cookie: session.join('; ') }
    expect(await check(auth, { method: 'GET', url: '/pty', headers }, true)).toMatchObject({ ok: true })
    expect(await check(auth, { method: 'GET', url: '/pty', headers: { ...headers, cookie: '' } }, true)).toMatchObject({
      status: 401,
    })
    expect(
      await check(auth, { method: 'GET', url: '/pty', headers: { ...headers, origin: 'https://evil.test' } }, true),
    ).toMatchObject({ status: 403 })
    expect(
      await check(auth, { method: 'GET', url: '/pty', headers: { host: HOST, cookie: headers.cookie } }, true),
    ).toMatchObject({
      status: 403,
    })
  })

  it('sets strict browser security headers', async () => {
    const res = await get('/zync/api/auth/status')
    expect(res.headers['strict-transport-security']).toContain('max-age=')
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
    expect(res.headers['referrer-policy']).toBe('no-referrer')
  })
})

describe('Cloudflare Access', () => {
  it('refuses every request without a valid Access token, even the sign-in API', async () => {
    const verifyAccess = vi.fn<(t: string | undefined) => Promise<boolean>>(async (t) => t === 'good')
    auth = new Auth(authConfig(ORIGIN, path.join(dir, 'cf')), { webauthn: fakeWebauthn, alert: alerts, verifyAccess })
    app = createApp({ workspacesRoot: dir, auth })
    expect((await get('/zync/api/auth/status')).status).toBe(403)
    expect((await get('/zync/api/auth/status').set('Cf-Access-Jwt-Assertion', 'forged')).status).toBe(403)
    expect((await get('/zync/api/auth/status').set('Cf-Access-Jwt-Assertion', 'good')).status).toBe(200)
  })
})

describe('setup', () => {
  it('needs the setup code from the server log', async () => {
    await auth.newSetupCode()
    const res = await post('/zync/api/auth/setup/options', { code: 'AAAA-BBBB-CCCC-DDDD' })
    expect(res.status).toBe(401)
  })

  it('registers the first passkey, signs in and hands out recovery codes once', async () => {
    const { session, recoveryCodes } = await setUp()
    expect(recoveryCodes).toHaveLength(10)
    expect((await get('/zync/api/auth/status', session)).body).toMatchObject({
      authenticated: true,
      setupRequired: false,
    })
    expect(alerts).toHaveBeenCalledWith('zync set up', expect.any(String))
  })

  it('sets a __Host- session cookie the page scripts cannot read', async () => {
    const code = await auth.newSetupCode()
    const opts = await post('/zync/api/auth/setup/options', { code })
    const res = await post('/zync/api/auth/setup/verify', registration('c', opts.body.challenge), cookiesOf(opts))
    const set = setCookies(res).find((c) => c.startsWith('__Host-zync-session='))
    expect(set).toMatch(/Path=\/; Secure; HttpOnly; SameSite=Strict/)
  })

  it('cannot run again once set up', async () => {
    const { session } = await setUp()
    const code = await auth.newSetupCode()
    expect(code).toBeNull()
    expect((await post('/zync/api/auth/setup/options', { code: 'x' }, session)).status).toBe(409)
  })

  it('refuses a registration answered for another challenge', async () => {
    const code = await auth.newSetupCode()
    const opts = await post('/zync/api/auth/setup/options', { code })
    const res = await post('/zync/api/auth/setup/verify', registration('c', 'wrong'), cookiesOf(opts))
    expect(res.status).toBe(401)
    expect(await auth.store.hasCredentials()).toBe(false)
  })

  it('locks out after repeated wrong codes', async () => {
    await auth.newSetupCode()
    for (let i = 0; i < 5; i++) await post('/zync/api/auth/setup/options', { code: 'nope' })
    const res = await post('/zync/api/auth/setup/options', { code: 'nope' })
    expect(res.status).toBe(429)
    expect(res.headers['retry-after']).toBe('60')
    expect(alerts).toHaveBeenCalledWith('Sign-in locked', expect.any(String))
  })
})

describe('sign-in', () => {
  it('signs in with a registered passkey', async () => {
    await setUp()
    const res = await signIn()
    expect(res.status).toBe(200)
    expect((await get('/zync/api/workspaces', cookiesOf(res))).status).toBe(200)
  })

  it('refuses an unknown passkey or a bad signature', async () => {
    await setUp()
    expect((await signIn('someone-else')).status).toBe(401)
    const opts = await post('/zync/api/auth/login/options')
    expect((await post('/zync/api/auth/login/verify', assertion('cred-1', 'forged'), cookiesOf(opts))).status).toBe(401)
  })

  it('uses each challenge once', async () => {
    await setUp()
    const opts = await post('/zync/api/auth/login/options')
    const body = assertion('cred-1', opts.body.challenge)
    expect((await post('/zync/api/auth/login/verify', body, cookiesOf(opts))).status).toBe(200)
    expect((await post('/zync/api/auth/login/verify', body, cookiesOf(opts))).status).toBe(400)
  })

  it('accepts each recovery code once', async () => {
    const { recoveryCodes } = await setUp()
    const code = recoveryCodes[0] ?? ''
    const first = await post('/zync/api/auth/recovery', { code: code.toLowerCase() })
    expect(first.status).toBe(200)
    expect((await get('/zync/api/workspaces', cookiesOf(first))).status).toBe(200)
    expect((await post('/zync/api/auth/recovery', { code })).status).toBe(401)
  })

  it('ends a session on logout, after 12 h idle, and after 7 days', async () => {
    const { session } = await setUp()
    await post('/zync/api/auth/logout', {}, session)
    expect((await get('/zync/api/workspaces', session)).status).toBe(401)

    const idle = cookiesOf(await signIn())
    now += 13 * 3_600_000
    expect((await get('/zync/api/workspaces', idle)).status).toBe(401)

    const old = cookiesOf(await signIn())
    for (let h = 0; h < 7 * 24; h += 6) {
      now += 6 * 3_600_000
      await get('/zync/api/workspaces', old)
    }
    expect((await get('/zync/api/workspaces', old)).status).toBe(401)
  })
})

describe('account security', () => {
  it('needs a fresh passkey check to add a passkey or new recovery codes', async () => {
    const { session } = await setUp()
    now += 11 * 60_000
    const stale = await post('/zync/api/auth/recovery-codes', {}, session)
    expect(stale.status).toBe(403)
    expect(stale.body.stepUp).toBe(true)
    expect((await signIn('cred-1', session)).status).toBe(200)
    expect((await post('/zync/api/auth/recovery-codes', {}, session)).status).toBe(200)

    const opts = await post('/zync/api/auth/passkeys/options', {}, session)
    const added = await post(
      '/zync/api/auth/passkeys/verify',
      { ...registration('cred-2', opts.body.challenge), name: 'Phone' },
      [...session, ...cookiesOf(opts)],
    )
    expect(added.status).toBe(201)
    expect(alerts).toHaveBeenCalledWith('Passkey added', expect.stringContaining('Phone'))
  })

  it("won't remove the last passkey", async () => {
    const { session } = await setUp()
    const res = await request(app)
      .delete('/zync/api/auth/passkeys/cred-1')
      .set('Host', HOST)
      .set('Origin', ORIGIN)
      .set('Cookie', session)
    expect(res.status).toBe(409)
  })

  it('signs out every other device', async () => {
    const { session } = await setUp()
    const other = cookiesOf(await signIn())
    const res = await post('/zync/api/auth/sessions/revoke-others', {}, session)
    expect(res.body.revoked).toBe(1)
    expect((await get('/zync/api/workspaces', other)).status).toBe(401)
    expect((await get('/zync/api/workspaces', session)).status).toBe(200)
  })
})

describe('AuthStore', () => {
  it('keeps secrets hashed, in a private file', async () => {
    const { recoveryCodes } = await setUp()
    const file = path.join(dir, 'auth', 'auth.json')
    const text = await readFile(file, 'utf8')
    expect(text).not.toContain(recoveryCodes[0])
    expect((await stat(file)).mode & 0o777).toBe(0o600)
    expect((await stat(path.join(dir, 'auth'))).mode & 0o777).toBe(0o700)
  })

  it('fails closed on a damaged file', async () => {
    await setUp()
    await writeFile(path.join(dir, 'auth', 'auth.json'), '{"credentials": "oops"}')
    const store = new AuthStore(path.join(dir, 'auth'), { idleMs: 1, maxAgeMs: 1 })
    await expect(store.hasCredentials()).rejects.toBeInstanceOf(z.ZodError)
  })
})
