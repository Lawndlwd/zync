import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/** An unguessable token (256 bits), URL-safe. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')

/** What is stored instead of a token or code: its SHA-256. The tokens are random, so no salt is needed. */
export const hashSecret = (secret: string) => createHash('sha256').update(secret).digest('hex')

/** Constant-time comparison of two secrets of any length. */
export const sameSecret = (a: string, b: string) =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())

// Crockford base32: no I, L, O, U, so a code copied by hand can't be misread.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** A code a person types: 16 characters (80 bits) in groups of four, e.g. "7K2M-QX9D-4HNR-WB3T". */
export function humanCode(): string {
  const chars = Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)] ?? '0')
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-')
}

/** A typed code as generated: case, spaces and dashes ignored; look-alike letters mapped back. */
export const normalizeCode = (code: string) =>
  code.toUpperCase().replaceAll(/[\s-]/g, '').replaceAll('O', '0').replaceAll(/[IL]/g, '1')
