import type { IncomingHttpHeaders, IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'

import type { NextFunction, Request, Response } from 'express'

import { parseCookies, SESSION_COOKIE } from './cookies.js'
import type { Auth } from './service.js'
import type { Session } from './store.js'

// The single gate every request passes, HTTP and WebSocket alike, before anything else runs:
//   1. Host is exactly the app's host             → no DNS-rebinding
//   2. Cloudflare Access token (when configured)  → nothing reaches zync around Access
//   3. no cross-site requests, Origin = the app   → no CSRF, no cross-site WebSocket
//   4. a live session, except for the sign-in page and its API
// Anything not explicitly public needs a session: a new route is protected without doing anything.

const HEALTH = '/zync/api/health'
/** Reachable without a session (still after checks 1–3). */
const PUBLIC = new Set([
  '/login',
  '/zync/api/auth/status',
  '/zync/api/auth/setup/options',
  '/zync/api/auth/setup/verify',
  '/zync/api/auth/login/options',
  '/zync/api/auth/login/verify',
  '/zync/api/auth/recovery',
  '/zync/api/auth/logout',
])
const isPublic = (path: string) => PUBLIC.has(path) || path.startsWith('/zync/assets/')
/** The app's pages: without a session they redirect to the sign-in page. */
const isPage = (path: string) => path === '/' || path === '/w' || path.startsWith('/w/')

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

type Refusal = { status: number; error: string }
export type Verdict = { ok: true; session: Session | null } | ({ ok: false } & Refusal)

const header = (h: IncomingHttpHeaders, name: string) => {
  const v = h[name]
  return Array.isArray(v) ? v[0] : v
}

/** The caller's address, for alerts and rate limits: Cloudflare's view when Access is in front. */
export function clientIp(auth: Auth, req: IncomingMessage): string {
  const cf = auth.cfg.cfAccess ? header(req.headers, 'cf-connecting-ip') : undefined
  return cf ?? req.socket.remoteAddress ?? 'unknown'
}

async function sessionOfHeaders(auth: Auth, headers: IncomingHttpHeaders): Promise<Session | null> {
  const token = parseCookies(header(headers, 'cookie')).get(SESSION_COOKIE)
  return token ? auth.store.findSession(token) : null
}

/** Checks 1–4 for one request (or WebSocket upgrade). */
export async function check(
  auth: Auth,
  req: { method?: string | undefined; url?: string | undefined; headers: IncomingHttpHeaders },
  upgrade = false,
): Promise<Verdict> {
  const path = new URL(req.url ?? '/', 'http://x').pathname
  const method = (req.method ?? 'GET').toUpperCase()
  const h = req.headers
  // The container's health check calls this on localhost; it says nothing but "up".
  if (path === HEALTH && method === 'GET' && !upgrade) return { ok: true, session: null }

  if ((header(h, 'host') ?? '').toLowerCase() !== auth.cfg.host.toLowerCase())
    return { ok: false, status: 421, error: 'Unknown host' }

  if (auth.verifyAccess && !(await auth.verifyAccess(header(h, 'cf-access-jwt-assertion'))))
    return { ok: false, status: 403, error: 'Cloudflare Access is required' }

  const site = header(h, 'sec-fetch-site')
  const topLevelVisit =
    method === 'GET' && header(h, 'sec-fetch-mode') === 'navigate' && header(h, 'sec-fetch-dest') === 'document'
  if (site && site !== 'same-origin' && site !== 'none' && !topLevelVisit)
    return { ok: false, status: 403, error: 'Cross-site request refused' }
  const origin = header(h, 'origin')
  if (origin !== undefined ? origin !== auth.cfg.origin : upgrade || !SAFE.has(method))
    return { ok: false, status: 403, error: 'Cross-origin request refused' }

  const session = await sessionOfHeaders(auth, h)
  if (!session && !isPublic(path)) return { ok: false, status: 401, error: 'Sign in required' }
  return { ok: true, session }
}

const sessions = new WeakMap<Request, Session>()

/** The session of a request that passed the guard (null on public paths without one). */
export const sessionOf = (req: Request): Session | null => sessions.get(req) ?? null

/** Express middleware: the gate for every HTTP request. */
export function guard(auth: Auth) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const v = await check(auth, req)
    if (v.ok) {
      if (v.session) sessions.set(req, v.session)
      next()
      return
    }
    // Opening a page without a session: go sign in, then come back.
    if (v.status === 401 && req.method === 'GET' && isPage(req.path)) {
      res.redirect(302, `/login?next=${encodeURIComponent(req.originalUrl)}`)
      return
    }
    res.status(v.status).json({ error: v.error })
  }
}

/** The gate for WebSocket upgrades (opencode's terminal and live UI), in front of `handle`. */
export function guardUpgrade(auth: Auth, handle: (req: IncomingMessage, socket: Duplex, head: Buffer) => void) {
  const gate = async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    try {
      const v = await check(auth, req, true)
      if (v.ok) handle(req, socket, head)
      else socket.end(`HTTP/1.1 ${v.status} ${v.error}\r\nConnection: close\r\n\r\n`)
    } catch {
      socket.destroy()
    }
  }
  return (req: IncomingMessage, socket: Duplex, head: Buffer) => void gate(req, socket, head)
}
