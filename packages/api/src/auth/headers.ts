import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import type { NextFunction, Request, Response } from 'express'

/** Browser hardening on every response (the app, its API, and opencode's pages through the proxy). */
export function securityHeaders(https: boolean) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
    if (https) res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
    next()
  }
}

/**
 * The Content-Security-Policy for the app's page: its own scripts only (plus the inline theme
 * script, allowed by hash), styles and fonts from itself and Google Fonts, no plugins, no base or
 * form tricks, framed only by itself.
 */
export function pageCsp(indexHtmlPath: string): string {
  const html = readFileSync(indexHtmlPath, 'utf8')
  const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    (m) =>
      `'sha256-${createHash('sha256')
        .update(m[1] ?? '')
        .digest('base64')}'`,
  )
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ')
}
