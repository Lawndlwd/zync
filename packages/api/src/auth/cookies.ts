// Cookies: parsed by hand (two cookies, no dependency). The session cookie uses the __Host- prefix,
// so the browser only accepts it over HTTPS, for this exact host, on path "/": no subdomain or
// plain-HTTP page can set or overwrite it.

export const SESSION_COOKIE = '__Host-zync-session'
/** Binds a passkey ceremony (options → answer) to the browser that started it. */
export const CEREMONY_COOKIE = '__Host-zync-ceremony'

export function parseCookies(header: string | undefined): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const name = part.slice(0, i).trim()
    // First one wins, like browsers send the most specific first.
    if (!out.has(name)) {
      try {
        out.set(name, decodeURIComponent(part.slice(i + 1).trim()))
      } catch {
        // A malformed value is ignored, never trusted.
      }
    }
  }
  return out
}

/** A strict, script-proof cookie. `maxAgeMs` 0 deletes it. */
export const cookie = (name: string, value: string, maxAgeMs: number) =>
  `${name}=${encodeURIComponent(value)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs / 1000)}`
