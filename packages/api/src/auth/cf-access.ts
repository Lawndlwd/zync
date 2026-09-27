import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose'

import type { CfAccessConfig } from './config.js'

/** Why a token was refused, in terms of the settings to check. Never includes the token. */
function describe(err: unknown, cfg: CfAccessConfig, issuer: string): string {
  const code = typeof err === 'object' && err !== null ? Reflect.get(err, 'code') : undefined
  const claim = typeof err === 'object' && err !== null ? Reflect.get(err, 'claim') : undefined
  if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && claim === 'aud')
    return `the token is for another Access application: CF_ACCESS_AUD (${cfg.aud.slice(0, 8)}…) is not its AUD tag`
  if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && claim === 'iss')
    return `the token comes from another team: expected ${issuer}, check CF_ACCESS_TEAM_DOMAIN`
  if (code === 'ERR_JWT_EXPIRED') return 'the token expired'
  if (code === 'ERR_JWKS_NO_MATCHING_KEY' || code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED')
    return `the signature doesn't match ${issuer}'s keys: check CF_ACCESS_TEAM_DOMAIN`
  if (code === 'ERR_JWKS_TIMEOUT' || code === 'ERR_JOSE_GENERIC' || err instanceof TypeError)
    return `the signing keys couldn't be fetched from ${issuer}: does the api container have internet access?`
  return `invalid token (${typeof code === 'string' ? code : err instanceof Error ? err.message : 'unknown'})`
}

/** Logs each distinct refusal reason at most once a minute; always answers "refused". */
function refusalLog(now: () => number = Date.now) {
  const last = new Map<string, number>()
  return (reason: string) => {
    const t = now()
    if ((last.get(reason) ?? 0) + 60_000 <= t) {
      last.set(reason, t)
      console.warn(`[auth] Cloudflare Access refused: ${reason}`)
    }
    return false
  }
}

/** Checks the token Cloudflare Access adds to every request it let through. */
export type AccessVerifier = (token: string | undefined) => Promise<boolean>

/**
 * A verifier for Cloudflare Access tokens: signed by the team's keys, for this application (AUD),
 * not expired, and for the expected identity when one is configured. `keys` is for tests.
 */
export function accessVerifier(cfg: CfAccessConfig, keys?: JWTVerifyGetKey): AccessVerifier {
  const issuer = `https://${cfg.teamDomain}`
  const jwks = keys ?? createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`))
  const refuse = refusalLog()
  return async (token) => {
    if (!token) return refuse('no Cf-Access-Jwt-Assertion header: the request did not come through Access')
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer, audience: cfg.aud, algorithms: ['RS256'] })
      if (!cfg.email || (typeof payload.email === 'string' && payload.email.toLowerCase() === cfg.email.toLowerCase()))
        return true
      return refuse('the token is for another identity than CF_ACCESS_EMAIL')
    } catch (err) {
      // Bad signature, wrong audience, expired, or the keys couldn't be fetched: not let in.
      return refuse(describe(err, cfg, issuer))
    }
  }
}
