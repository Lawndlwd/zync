import type {
  AuthenticationResponseJSON,
  AuthenticatorTransport,
  RegistrationResponseJSON,
} from '@simplewebauthn/server'
import type { z } from 'zod'

import type { AuthenticationBody, RegistrationBody } from '../body.js'
import { type Alert, ntfyAlert } from './alerts.js'
import { type AccessVerifier, accessVerifier } from './cf-access.js'
import type { AuthConfig } from './config.js'
import { humanCode, normalizeCode, randomToken, sameSecret } from './crypto.js'
import { FailureLimiter } from './limiter.js'
import { AuthStore } from './store.js'
import { type Webauthn, webauthn } from './webauthn.js'

/** What a passkey ceremony is for; a ceremony started for one purpose can't finish another. */
export type CeremonyKind = 'setup' | 'login' | 'add'

type Ceremony = { kind: CeremonyKind; challenge: string; expires: number; sessionId: string | null }

const CEREMONY_MS = 5 * 60_000
const SETUP_CODE_MS = 60 * 60_000

/** Everything the guard and the auth routes share. One per app. */
export class Auth {
  readonly store: AuthStore
  readonly limiter: FailureLimiter
  readonly verifyAccess: AccessVerifier | null
  readonly webauthn: Webauthn
  readonly alert: Alert
  private ceremonies = new Map<string, Ceremony>()
  private setup: { code: string; expires: number } | null = null

  constructor(
    readonly cfg: AuthConfig,
    deps: Partial<{
      store: AuthStore
      webauthn: Webauthn
      alert: Alert
      verifyAccess: AccessVerifier
      now: () => number
    }> = {},
    readonly now: () => number = deps.now ?? Date.now,
  ) {
    this.store = deps.store ?? new AuthStore(cfg.dir, cfg, this.now)
    this.limiter = new FailureLimiter(this.now)
    this.webauthn = deps.webauthn ?? webauthn(cfg)
    this.alert = deps.alert ?? ntfyAlert(process.env)
    this.verifyAccess = deps.verifyAccess ?? (cfg.cfAccess ? accessVerifier(cfg.cfAccess) : null)
  }

  /**
   * While no passkey exists: a fresh one-time setup code, valid for an hour, for the server log.
   * Only someone who can read the server's logs can register the first passkey.
   */
  async newSetupCode(): Promise<string | null> {
    if (await this.store.hasCredentials()) return null
    const code = humanCode()
    this.setup = { code, expires: this.now() + SETUP_CODE_MS }
    return code
  }

  checkSetupCode(code: string): boolean {
    const s = this.setup
    return !!s && s.expires > this.now() && sameSecret(normalizeCode(code), normalizeCode(s.code))
  }

  endSetup(): void {
    this.setup = null
  }

  /** Start a ceremony: its id goes in a cookie, its challenge to the browser. */
  startCeremony(kind: CeremonyKind, sessionId: string | null): { id: string; challenge: string } {
    const now = this.now()
    for (const [id, c] of this.ceremonies) if (c.expires <= now) this.ceremonies.delete(id)
    const id = randomToken()
    const challenge = randomToken()
    this.ceremonies.set(id, { kind, challenge, expires: now + CEREMONY_MS, sessionId })
    return { id, challenge }
  }

  /** Finish a ceremony (it can be finished once): its challenge, when it matches kind and session. */
  takeCeremony(id: string | undefined, kind: CeremonyKind, sessionId: string | null): string | null {
    if (!id) return null
    const c = this.ceremonies.get(id)
    this.ceremonies.delete(id)
    if (!c || c.kind !== kind || c.expires <= this.now() || c.sessionId !== sessionId) return null
    return c.challenge
  }
}

// The request bodies, rebuilt with only what verification reads (the library's types don't allow
// explicit `undefined` for optional fields).

const TRANSPORTS = new Set<string>(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb'])
const isTransport = (t: string): t is AuthenticatorTransport => TRANSPORTS.has(t)

export const toRegistration = (b: z.infer<typeof RegistrationBody>['response']): RegistrationResponseJSON => ({
  id: b.id,
  rawId: b.rawId,
  type: 'public-key',
  clientExtensionResults: {},
  response: {
    clientDataJSON: b.response.clientDataJSON,
    attestationObject: b.response.attestationObject,
    ...(b.response.transports ? { transports: b.response.transports.filter(isTransport) } : {}),
  },
})

export const toAuthentication = (b: z.infer<typeof AuthenticationBody>['response']): AuthenticationResponseJSON => ({
  id: b.id,
  rawId: b.rawId,
  type: 'public-key',
  clientExtensionResults: {},
  response: { ...b.response },
})
