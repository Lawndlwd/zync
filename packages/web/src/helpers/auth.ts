/**
 * Where to go after signing in: a path inside the app, never another site. Anything else (a full
 * URL, "//evil.test", "/\\evil.test", the sign-in page itself) falls back to the home page.
 */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  const url = new URL(next, 'https://zync.invalid')
  if (url.origin !== 'https://zync.invalid' || url.pathname === '/login') return '/'
  return url.pathname + url.search + url.hash
}

/** The server wants a fresh passkey check before this action (403 with `stepUp`). */
export const isStepUp = (body: unknown) =>
  typeof body === 'object' && body !== null && 'stepUp' in body && body.stepUp === true

/** A passkey prompt's failure, in words. */
export function passkeyError(err: unknown): string {
  if (err instanceof Error && err.name === 'NotAllowedError') return 'Cancelled, or the passkey prompt timed out.'
  if (err instanceof Error && err.name === 'InvalidStateError') return 'This device already has a passkey for zync.'
  return err instanceof Error ? err.message : String(err)
}

/** "Chrome on macOS" from a user agent, good enough to recognise your own devices. */
export function deviceName(userAgent: string): string {
  const browser =
    [/Edg\//, /OPR\//, /Firefox\//, /Chrome\//, /Safari\//]
      .map((re, i) => (re.test(userAgent) ? ['Edge', 'Opera', 'Firefox', 'Chrome', 'Safari'][i] : undefined))
      .find(Boolean) ?? 'Browser'
  const os =
    [/iPhone|iPad/, /Android/, /Mac OS X/, /Windows/, /Linux/]
      .map((re, i) => (re.test(userAgent) ? ['iOS', 'Android', 'macOS', 'Windows', 'Linux'][i] : undefined))
      .find(Boolean) ?? ''
  return os ? `${browser} on ${os}` : browser
}
