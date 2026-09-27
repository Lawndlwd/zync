import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server'
import type * as SimpleWebauthn from '@simplewebauthn/server'

import type { AuthConfig } from './config.js'
import type { Credential } from './store.js'

// Passkey ceremonies. Every passkey must be discoverable (sign in without a user name) and verify
// the user (Face ID, fingerprint, PIN): possession alone is never enough.

type RegisteredPasskey = { id: string; publicKey: string; counter: number; transports: string[] }

/** The WebAuthn operations the routes need; replaced by a fake in tests. */
export type Webauthn = {
  registrationOptions: (
    userId: string,
    exclude: Credential[],
    challenge: string,
  ) => Promise<PublicKeyCredentialCreationOptionsJSON>
  verifyRegistration: (response: RegistrationResponseJSON, challenge: string) => Promise<RegisteredPasskey | null>
  authenticationOptions: (challenge: string) => Promise<PublicKeyCredentialRequestOptionsJSON>
  /** The passkey's new counter when the signature is valid, else null. */
  verifyAuthentication: (
    response: AuthenticationResponseJSON,
    challenge: string,
    credential: Credential,
  ) => Promise<number | null>
}

// Loaded on first use: the library (and its certificate parsers) is large, and the server should
// start without waiting for it.
/**
 * A challenge (a base64url token) as the bytes the browser signs. Handed over as a string, the
 * library would encode the string's characters instead, and the answer would carry a different
 * challenge than the one stored.
 */
const bytes = (challenge: string) => new Uint8Array(Buffer.from(challenge, 'base64url'))

let lib: Promise<typeof SimpleWebauthn> | null = null
const load = () => (lib ??= import('@simplewebauthn/server'))

export function webauthn(cfg: AuthConfig): Webauthn {
  const expected = { expectedOrigin: cfg.origin, expectedRPID: cfg.rpId, requireUserVerification: true }
  return {
    registrationOptions: async (userId, exclude, challenge) =>
      (await load()).generateRegistrationOptions({
        rpName: 'zync',
        rpID: cfg.rpId,
        userName: 'owner',
        userDisplayName: 'zync owner',
        userID: Buffer.from(userId, 'base64url'),
        challenge: bytes(challenge),
        attestationType: 'none',
        excludeCredentials: exclude.map((c) => ({ id: c.id, transports: c.transports })),
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      }),
    verifyRegistration: async (response, challenge) => {
      const { verifyRegistrationResponse } = await load()
      const r = await verifyRegistrationResponse({ response, expectedChallenge: challenge, ...expected }).catch(
        (err: unknown) => {
          // Details stay in the server log; the browser only hears "registration failed".
          console.warn('[auth] passkey registration refused:', err)
          return null
        },
      )
      if (!r?.verified || !r.registrationInfo.userVerified) return null
      const c = r.registrationInfo.credential
      return {
        id: c.id,
        publicKey: Buffer.from(c.publicKey).toString('base64url'),
        counter: c.counter,
        transports: c.transports ?? [],
      }
    },
    authenticationOptions: async (challenge) =>
      (await load()).generateAuthenticationOptions({
        rpID: cfg.rpId,
        challenge: bytes(challenge),
        userVerification: 'required',
        allowCredentials: [],
      }),
    verifyAuthentication: async (response, challenge, credential) => {
      const r = await (
        await load()
      ).verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        ...expected,
        credential: {
          id: credential.id,
          publicKey: Buffer.from(credential.publicKey, 'base64url'),
          counter: credential.counter,
          transports: credential.transports,
        },
      })
      return r.verified && r.authenticationInfo.userVerified ? r.authenticationInfo.newCounter : null
    },
  }
}
