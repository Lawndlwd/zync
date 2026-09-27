import { describe, expect, it } from 'vitest'

import { authConfig, authConfigFromEnv, teamHost } from './config.js'

describe('teamHost', () => {
  it.each([
    'levende.cloudflareaccess.com',
    'https://levende.cloudflareaccess.com',
    'https://Levende.cloudflareaccess.com/',
  ])('accepts %s', (v) => {
    expect(teamHost(v)).toBe('levende.cloudflareaccess.com')
  })

  it.each(['http://levende.cloudflareaccess.com', 'evil.test', 'levende.cloudflareaccess.com.evil.test', ''])(
    'refuses %s',
    (v) => {
      expect(() => teamHost(v)).toThrow('CF_ACCESS_TEAM_DOMAIN')
    },
  )
})

describe('authConfigFromEnv', () => {
  it('reads the app address and Cloudflare Access', () => {
    const cfg = authConfigFromEnv({
      APP_URL: 'https://zync.levende.net',
      ZYNC_AUTH_DIR: '/zync-auth',
      CF_ACCESS_TEAM_DOMAIN: 'https://levende.cloudflareaccess.com',
      CF_ACCESS_AUD: ' aud-tag ',
    })
    expect(cfg).toMatchObject({
      origin: 'https://zync.levende.net',
      host: 'zync.levende.net',
      rpId: 'zync.levende.net',
    })
    expect(cfg.cfAccess).toEqual({ teamDomain: 'levende.cloudflareaccess.com', aud: 'aud-tag', email: undefined })
  })

  it('needs APP_URL, and both Access values or neither', () => {
    expect(() => authConfigFromEnv({})).toThrow('APP_URL')
    expect(() => authConfigFromEnv({ APP_URL: 'https://z.test', CF_ACCESS_AUD: 'x' })).toThrow('both')
  })

  it('refuses plain http except on localhost', () => {
    expect(() => authConfig('http://zync.levende.net', '/x')).toThrow('https')
    expect(authConfig('http://localhost:5173', '/x').origin).toBe('http://localhost:5173')
  })
})
