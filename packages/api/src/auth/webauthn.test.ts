import { describe, expect, it } from 'vitest'

import { authConfig } from './config.js'
import { randomToken } from './crypto.js'
import { webauthn } from './webauthn.js'

// The real library, not the fake the route tests use: the challenge in the options must be the
// exact token the server keeps, or no answer can ever match it.
const wa = webauthn(authConfig('https://zync.test', '/unused'))

describe('webauthn options', () => {
  it('asks the browser to sign exactly the stored challenge', { timeout: 60_000 }, async () => {
    const challenge = randomToken()
    expect((await wa.registrationOptions(randomToken(16), [], challenge)).challenge).toBe(challenge)
    expect((await wa.authenticationOptions(challenge)).challenge).toBe(challenge)
  })

  it('requires a discoverable, user-verified passkey bound to the host', async () => {
    const opts = await wa.registrationOptions(randomToken(16), [], randomToken())
    expect(opts.rp.id).toBe('zync.test')
    expect(opts.authenticatorSelection).toMatchObject({ residentKey: 'required', userVerification: 'required' })
    expect(opts.attestation).toBe('none')
  })

  it('refuses a malformed registration instead of throwing', async () => {
    const bad = {
      id: 'x',
      rawId: 'x',
      type: 'public-key' as const,
      clientExtensionResults: {},
      response: { clientDataJSON: 'e30', attestationObject: 'x' },
    }
    expect(await wa.verifyRegistration(bad, randomToken())).toBeNull()
  })
})
