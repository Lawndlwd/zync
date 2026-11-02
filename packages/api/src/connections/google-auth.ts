import { httpError } from '@zync/jobs'
import { z } from 'zod'

import { fetchJson } from './http.js'

// Sign in with Google (OAuth 2.0, web server flow): read-only Gmail and Calendar, plus the email to
// tell accounts apart. `access_type=offline` + `prompt=consent` so Google always hands a refresh
// token, even to an account connected before.

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
]

export type GoogleClient = { clientId: string; clientSecret: string; redirectUri: string }

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export function googleAuthUrl(client: GoogleClient, state: string): string {
  const q = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
}

const TokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
})
const UserInfoSchema = z.object({ email: z.string() })

/** Trade the code Google sent back for a refresh token, and find out which account it is. */
export async function googleExchange(
  client: GoogleClient,
  code: string,
): Promise<{ email: string; refreshToken: string }> {
  const t = await fetchJson(TOKEN_URL, TokenSchema, {
    form: {
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: client.redirectUri,
      grant_type: 'authorization_code',
    },
  })
  if (!t.refresh_token)
    throw httpError(502, 'Google sent no refresh token: remove zync from your Google account and connect again')
  const granted = new Set(t.scope?.split(' ') ?? [])
  const missing = GOOGLE_SCOPES.filter((s) => s.startsWith('https://') && !granted.has(s))
  if (missing.length)
    throw httpError(400, 'Allow zync to read Gmail and Calendar (tick both boxes on Google’s page), then connect again')
  const me = await fetchJson('https://openidconnect.googleapis.com/v1/userinfo', UserInfoSchema, {
    token: t.access_token,
  })
  return { email: me.email, refreshToken: t.refresh_token }
}

/** Short-lived access tokens, one per connection, reused until a minute before they expire. */
export class GoogleTokens {
  private cache = new Map<string, { token: string; until: number }>()

  constructor(
    private readonly client: GoogleClient,
    private readonly now: () => number = Date.now,
  ) {}

  async get(connection: string, refreshToken: string): Promise<string> {
    const hit = this.cache.get(connection)
    if (hit && hit.until > this.now()) return hit.token
    const t = await fetchJson(TOKEN_URL, TokenSchema, {
      form: {
        refresh_token: refreshToken,
        client_id: this.client.clientId,
        client_secret: this.client.clientSecret,
        grant_type: 'refresh_token',
      },
    })
    this.cache.set(connection, { token: t.access_token, until: this.now() + (t.expires_in - 60) * 1000 })
    return t.access_token
  }

  forget(connection: string): void {
    this.cache.delete(connection)
  }
}
