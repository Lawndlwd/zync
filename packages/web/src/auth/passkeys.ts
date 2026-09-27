import { startAuthentication, startRegistration } from '@simplewebauthn/browser'

import { api, ApiError } from '../api'
import { isStepUp } from '../helpers/auth'

// Passkey ceremonies from the browser: ask the server for a challenge, let the device sign it
// (Face ID, fingerprint, PIN, security key), send the answer back.

/** Sign in, or confirm who you are when already signed in (a fresh check for sensitive changes). */
export async function signInWithPasskey(): Promise<void> {
  const optionsJSON = await api.loginOptions()
  await api.loginVerify(await startAuthentication({ optionsJSON }))
}

/** The very first passkey, with the setup code from the server log. Returns the recovery codes. */
export async function registerFirstPasskey(code: string, name: string): Promise<string[]> {
  const optionsJSON = await api.setupOptions(code)
  return (await api.setupVerify(await startRegistration({ optionsJSON }), name)).recoveryCodes
}

/** Another passkey (a phone, a security key) for the signed-in owner. */
export async function registerPasskey(name: string): Promise<void> {
  const optionsJSON = await api.passkeyOptions()
  await api.addPasskey(await startRegistration({ optionsJSON }), name)
}

/** Run a sensitive action; if the server wants a fresh passkey check, do it and try once more. */
export async function withPasskeyCheck<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 403 && isStepUp(err.body))) throw err
    await signInWithPasskey()
    return action()
  }
}
