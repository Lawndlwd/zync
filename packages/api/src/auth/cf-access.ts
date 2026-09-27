import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose'

import type { CfAccessConfig } from './config.js'

/** Checks the token Cloudflare Access adds to every request it let through. */
export type AccessVerifier = (token: string | undefined) => Promise<boolean>

/**
 * A verifier for Cloudflare Access tokens: signed by the team's keys, for this application (AUD),
 * not expired, and for the expected identity when one is configured. `keys` is for tests.
 */
export function accessVerifier(cfg: CfAccessConfig, keys?: JWTVerifyGetKey): AccessVerifier {
  const issuer = `https://${cfg.teamDomain}`
  const jwks = keys ?? createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`))
  return async (token) => {
    if (!token) return false
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer, audience: cfg.aud, algorithms: ['RS256'] })
      return (
        !cfg.email || (typeof payload.email === 'string' && payload.email.toLowerCase() === cfg.email.toLowerCase())
      )
    } catch {
      // Bad signature, wrong audience, expired, or the keys couldn't be fetched: not let in.
      return false
    }
  }
}
