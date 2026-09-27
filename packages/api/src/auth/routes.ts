import { badRequest, httpError } from '@zync/jobs'
import express, { type Request, type Response, Router } from 'express'

import { AuthenticationBody, CodeBody, RegistrationBody } from '../body.js'
import { CEREMONY_COOKIE, cookie, parseCookies, SESSION_COOKIE } from './cookies.js'
import { clientIp, sessionOf } from './guard.js'
import { type Auth, toAuthentication, toRegistration } from './service.js'
import type { Session } from './store.js'

// Sign-in and account security. Mounted at /zync/api/auth, behind the guard: status, setup, login,
// recovery and logout are public (see guard.ts), everything else needs a session.

const CEREMONY_MS = 5 * 60_000
const GLOBAL = 'global'

const denied = (msg = 'Not signed in') => httpError(401, msg)

const device = (req: Request) => req.get('user-agent') ?? 'unknown'
const ceremonyId = (req: Request) => parseCookies(req.get('cookie')).get(CEREMONY_COOKIE)
const endCeremony = (res: Response) => res.append('Set-Cookie', cookie(CEREMONY_COOKIE, '', 0))
const need = (req: Request) => {
  const s = sessionOf(req)
  if (!s) throw denied()
  return s
}

export function authRoutes(auth: Auth): Router {
  const r = Router()
  r.use(express.json({ limit: '32kb' }))
  r.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  const ip = (req: Request) => clientIp(auth, req)
  const keys = (req: Request) => [GLOBAL, ip(req)]

  const beginCeremony = (res: Response, kind: Parameters<Auth['startCeremony']>[0], session: Session | null) => {
    const c = auth.startCeremony(kind, session?.id ?? null)
    res.append('Set-Cookie', cookie(CEREMONY_COOKIE, c.id, CEREMONY_MS))
    return c.challenge
  }

  const slowDown = (req: Request) => {
    const wait = auth.limiter.retryAfter(keys(req))
    if (wait > 0) throw Object.assign(httpError(429, 'Too many attempts, try again later'), { retryAfter: wait })
  }
  const failed = (req: Request, what: string) => {
    if (auth.limiter.fail(keys(req))) auth.alert('Sign-in locked', `Repeated failed ${what} from ${ip(req)}`)
    return denied(`${what[0]?.toUpperCase() ?? ''}${what.slice(1)} failed`)
  }

  const signIn = async (req: Request, res: Response, how: string) => {
    auth.limiter.succeed(keys(req))
    const { token } = await auth.store.createSession({ ip: ip(req), userAgent: device(req) })
    res.append('Set-Cookie', cookie(SESSION_COOKIE, token, auth.cfg.maxAgeMs))
    auth.alert('New sign-in', `${how} · ${ip(req)} · ${device(req)}`)
  }

  /** Sensitive changes need a passkey check from the last few minutes. */
  const needRecent = (req: Request) => {
    const s = need(req)
    if (auth.now() - s.authAt > auth.cfg.stepUpMs)
      throw Object.assign(httpError(403, 'Confirm with your passkey first'), { stepUp: true })
    return s
  }

  r.get('/status', async (req, res) => {
    const session = sessionOf(req)
    res.json({
      authenticated: !!session,
      setupRequired: !(await auth.store.hasCredentials()),
      ...(session ? { recoveryCodesLeft: await auth.store.recoveryCodesLeft() } : {}),
    })
  })

  // ── first passkey, with the setup code from the server log ──

  r.post('/setup/options', async (req, res) => {
    slowDown(req)
    if (await auth.store.hasCredentials()) throw httpError(409, 'zync is already set up')
    if (!auth.checkSetupCode(CodeBody.parse(req.body).code)) throw failed(req, 'setup code')
    const challenge = beginCeremony(res, 'setup', null)
    res.json(await auth.webauthn.registrationOptions(await auth.store.userId(), [], challenge))
  })

  r.post('/setup/verify', async (req, res) => {
    const body = RegistrationBody.parse(req.body)
    const challenge = auth.takeCeremony(ceremonyId(req), 'setup', null)
    endCeremony(res)
    if (!challenge) throw badRequest('Start again: the setup expired')
    if (await auth.store.hasCredentials()) throw httpError(409, 'zync is already set up')
    const passkey = await auth.webauthn.verifyRegistration(toRegistration(body.response), challenge)
    if (!passkey) throw failed(req, 'passkey registration')
    await auth.store.addCredential({ ...passkey, name: body.name || 'First passkey' })
    auth.endSetup()
    const recoveryCodes = await auth.store.newRecoveryCodes()
    await signIn(req, res, 'setup')
    auth.alert('zync set up', `First passkey registered from ${ip(req)}`)
    res.status(201).json({ recoveryCodes })
  })

  // ── sign in (or confirm, when already signed in) with a passkey ──

  r.post('/login/options', async (req, res) => {
    slowDown(req)
    const challenge = beginCeremony(res, 'login', sessionOf(req))
    res.json(await auth.webauthn.authenticationOptions(challenge))
  })

  r.post('/login/verify', async (req, res) => {
    slowDown(req)
    const body = AuthenticationBody.parse(req.body)
    const session = sessionOf(req)
    const challenge = auth.takeCeremony(ceremonyId(req), 'login', session?.id ?? null)
    endCeremony(res)
    if (!challenge) throw badRequest('Start again: the sign-in expired')
    const credential = (await auth.store.credentials()).find((c) => c.id === body.response.id)
    const counter = credential
      ? await auth.webauthn
          .verifyAuthentication(toAuthentication(body.response), challenge, credential)
          .catch(() => null)
      : null
    if (!credential || counter === null) throw failed(req, 'passkey sign-in')
    await auth.store.useCredential(credential.id, counter)
    if (session) {
      auth.limiter.succeed(keys(req))
      await auth.store.stepUp(session.id)
    } else {
      await signIn(req, res, `passkey "${credential.name}"`)
    }
    res.json({ ok: true })
  })

  r.post('/recovery', async (req, res) => {
    slowDown(req)
    if (!(await auth.store.consumeRecoveryCode(CodeBody.parse(req.body).code))) throw failed(req, 'recovery code')
    await signIn(req, res, `recovery code (${await auth.store.recoveryCodesLeft()} left)`)
    res.json({ ok: true })
  })

  r.post('/logout', async (req, res) => {
    const s = sessionOf(req)
    if (s) await auth.store.revokeSession(s.id)
    res.append('Set-Cookie', cookie(SESSION_COOKIE, '', 0))
    res.status(204).end()
  })

  // ── passkeys ──

  r.get('/passkeys', async (req, res) => {
    need(req)
    res.json(
      (await auth.store.credentials()).map((c) => ({
        id: c.id,
        name: c.name,
        createdAt: c.createdAt,
        lastUsedAt: c.lastUsedAt ?? null,
      })),
    )
  })

  r.post('/passkeys/options', async (req, res) => {
    const s = needRecent(req)
    const challenge = beginCeremony(res, 'add', s)
    res.json(
      await auth.webauthn.registrationOptions(await auth.store.userId(), await auth.store.credentials(), challenge),
    )
  })

  r.post('/passkeys/verify', async (req, res) => {
    const s = needRecent(req)
    const body = RegistrationBody.parse(req.body)
    const challenge = auth.takeCeremony(ceremonyId(req), 'add', s.id)
    endCeremony(res)
    if (!challenge) throw badRequest('Start again: adding the passkey expired')
    const passkey = await auth.webauthn.verifyRegistration(toRegistration(body.response), challenge)
    if (!passkey) throw badRequest('The passkey could not be verified')
    const cred = await auth.store.addCredential({ ...passkey, name: body.name || 'Passkey' })
    auth.alert('Passkey added', `"${cred.name}" from ${ip(req)}`)
    res.status(201).json({ id: cred.id, name: cred.name, createdAt: cred.createdAt, lastUsedAt: null })
  })

  r.delete('/passkeys/:id', async (req, res) => {
    needRecent(req)
    const cred = (await auth.store.credentials()).find((c) => c.id === req.params.id)
    await auth.store.removeCredential(req.params.id)
    auth.alert('Passkey removed', `"${cred?.name ?? req.params.id}" from ${ip(req)}`)
    res.status(204).end()
  })

  // ── sessions ──

  r.get('/sessions', async (req, res) => {
    const current = need(req)
    res.json(
      (await auth.store.sessions()).map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        ip: s.ip,
        userAgent: s.userAgent,
        current: s.id === current.id,
      })),
    )
  })

  r.delete('/sessions/:id', async (req, res) => {
    const current = need(req)
    await auth.store.revokeSession(req.params.id)
    if (req.params.id === current.id) res.append('Set-Cookie', cookie(SESSION_COOKIE, '', 0))
    res.status(204).end()
  })

  r.post('/sessions/revoke-others', async (req, res) => {
    const current = need(req)
    const n = await auth.store.revokeSessions(current.id)
    if (n > 0) auth.alert('Signed out elsewhere', `${n} other session(s) ended from ${ip(req)}`)
    res.json({ revoked: n })
  })

  // ── recovery codes ──

  r.post('/recovery-codes', async (req, res) => {
    needRecent(req)
    const codes = await auth.store.newRecoveryCodes()
    auth.alert('New recovery codes', `Generated from ${ip(req)}; the old ones no longer work`)
    res.json({ recoveryCodes: codes })
  })

  return r
}
