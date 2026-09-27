import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Cloudflare Access in front of the app: every request must carry a token it signed for us. */
export type CfAccessConfig = {
  /** Bare host, e.g. "levende.cloudflareaccess.com" (see teamHost). */
  teamDomain: string
  /** The Access application's AUD tag. */
  aud: string
  /** When set, only this identity's tokens are accepted. */
  email?: string | undefined
}

export type AuthConfig = {
  /** The app's public origin, e.g. "https://zync.example.com": the only Origin accepted. */
  origin: string
  /** Its host (with port when not the default): the only Host header accepted. */
  host: string
  /** WebAuthn relying party id: the hostname. Passkeys are bound to it. */
  rpId: string
  /** Where credentials and sessions are kept. Not a workspace: the AI must never read it. */
  dir: string
  cfAccess?: CfAccessConfig | undefined
  /** A session ends after this long without a request… */
  idleMs: number
  /** …and after this long in any case. */
  maxAgeMs: number
  /** Changing passkeys or recovery codes needs a passkey check this recent. */
  stepUpMs: number
}

const HOUR = 3_600_000

const DEV_DIR = fileURLToPath(new URL('../../../../data/auth', import.meta.url))

/**
 * A Cloudflare Access team domain as its bare host: "https://levende.cloudflareaccess.com/" and
 * "levende.cloudflareaccess.com" both give "levende.cloudflareaccess.com". Anything that isn't a
 * cloudflareaccess.com team is refused: the signing keys are fetched from there.
 */
export function teamHost(value: string): string {
  const host = value
    .trim()
    .replace(/^https:\/\//i, '')
    .replace(/\/+$/, '')
    .toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]*\.cloudflareaccess\.com$/.test(host))
    throw new Error(`CF_ACCESS_TEAM_DOMAIN must look like https://<team>.cloudflareaccess.com: ${value}`)
  return host
}

/** The auth settings for an origin. `overrides` is for tests. */
export function authConfig(appUrl: string, dir: string, overrides: Partial<AuthConfig> = {}): AuthConfig {
  const url = new URL(appUrl)
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error(`APP_URL must be https (or http://localhost for development): ${appUrl}`)
  }
  return {
    origin: url.origin,
    host: url.host,
    rpId: url.hostname,
    dir,
    idleMs: 12 * HOUR,
    maxAgeMs: 7 * 24 * HOUR,
    stepUpMs: 10 * 60_000,
    ...overrides,
  }
}

/**
 * Auth settings from the environment: APP_URL (required), ZYNC_AUTH_DIR, and CF_ACCESS_TEAM_DOMAIN +
 * CF_ACCESS_AUD (+ CF_ACCESS_EMAIL) when Cloudflare Access sits in front.
 */
export function authConfigFromEnv(env: NodeJS.ProcessEnv): AuthConfig {
  const appUrl = env.APP_URL
  if (!appUrl) throw new Error('APP_URL is required: the address you open zync at, e.g. https://zync.example.com')
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN
  const aud = env.CF_ACCESS_AUD
  if (Boolean(teamDomain) !== Boolean(aud))
    throw new Error('Set both CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD, or neither')
  return authConfig(appUrl, path.resolve(env.ZYNC_AUTH_DIR || DEV_DIR), {
    cfAccess:
      teamDomain && aud
        ? { teamDomain: teamHost(teamDomain), aud: aud.trim(), email: env.CF_ACCESS_EMAIL || undefined }
        : undefined,
  })
}
