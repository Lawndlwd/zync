import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

import { type AccessVerifier, accessVerifier } from './cf-access.js'

const cfg = { teamDomain: 'team.cloudflareaccess.com', aud: 'aud-tag', email: 'me@example.com' }
let sign: (claims: Record<string, unknown>, opts?: { aud?: string; iss?: string; exp?: string }) => Promise<string>
let verify: AccessVerifier

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }
  verify = accessVerifier(cfg, createLocalJWKSet({ keys: [jwk] }))
  sign = (claims, opts = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(opts.iss ?? `https://${cfg.teamDomain}`)
      .setAudience(opts.aud ?? cfg.aud)
      .setExpirationTime(opts.exp ?? '5m')
      .sign(privateKey)
})

describe('accessVerifier', () => {
  it('accepts a token Access signed for this app and identity', async () => {
    expect(await verify(await sign({ email: 'Me@Example.com' }))).toBe(true)
  })

  it.each([
    ['another application', { aud: 'other' }],
    ['another team', { iss: 'https://evil.cloudflareaccess.com' }],
    ['an expired token', { exp: '-1m' }],
  ])('refuses %s', async (_, opts) => {
    expect(await verify(await sign({ email: cfg.email }, opts))).toBe(false)
  })

  it('refuses another identity, garbage and no token', async () => {
    expect(await verify(await sign({ email: 'someone@else.com' }))).toBe(false)
    expect(await verify('not.a.jwt')).toBe(false)
    expect(await verify(undefined)).toBe(false)
  })
})
