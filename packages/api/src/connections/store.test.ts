import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { ConnectionStore } from './store.js'

let dir: string
let store: ConnectionStore

beforeEach(async () => {
  dir = path.join(await mkdtemp(path.join(tmpdir(), 'conn-')), 'connections')
  store = new ConnectionStore(dir, () => 1000)
})

const google = (refreshToken: string) => ({ provider: 'google' as const, refreshToken })

describe('connection store', () => {
  it('keeps secrets in a private file and never lists them', async () => {
    const c = await store.save({ account: 'me@work.com', label: 'Work', secret: google('r1') })
    expect(c).toEqual({ id: c.id, provider: 'google', label: 'Work', account: 'me@work.com', createdAt: 1000 })
    expect(await store.list()).toEqual([c])
    expect((await stat(path.join(dir, 'connections.json'))).mode & 0o777).toBe(0o600)
    expect((await stat(dir)).mode & 0o777).toBe(0o700)
    expect(await readFile(path.join(dir, 'connections.json'), 'utf8')).toContain('r1')
  })

  it('connecting the same account again refreshes its secret and keeps its label', async () => {
    const a = await store.save({ account: 'me@work.com', label: 'Work', secret: google('r1') })
    await store.setError(a.id, 'expired')
    const b = await store.save({ account: 'me@work.com', secret: google('r2') })
    expect(b).toEqual({ ...a })
    expect((await store.get(a.id)).secret).toEqual(google('r2'))
    await store.save({ account: 'me@perso.com', secret: google('r3') })
    expect((await store.ofProvider('google')).map((c) => c.label)).toEqual(['Work', 'me@perso.com'])
    expect(await store.ofProvider('slack')).toEqual([])
  })

  it('renames, records errors and removes', async () => {
    const c = await store.save({
      account: 'acme',
      secret: { provider: 'slack', token: 't', userId: 'U', teamId: 'T', url: 'u' },
    })
    expect((await store.rename(c.id, '  ')).label).toBe('acme')
    await store.setError(c.id, 'invalid_auth')
    expect((await store.list())[0]?.error).toBe('invalid_auth')
    await store.remove(c.id)
    expect(await store.list()).toEqual([])
    await expect(store.remove(c.id)).rejects.toMatchObject({ status: 404 })
  })

  it('reads back what another instance wrote', async () => {
    await store.save({ account: 'me@work.com', secret: google('r1') })
    expect(await new ConnectionStore(dir).list()).toHaveLength(1)
  })
})
