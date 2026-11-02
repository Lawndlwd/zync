import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ConnectionsOptions } from './service.js'

const DEV_DIR = fileURLToPath(new URL('../../../../data/connections', import.meta.url))

/** Google comes back to this page of the app after its consent screen. */
const GOOGLE_CALLBACK = '/zync/api/connections/google/callback'

/**
 * Connections from the environment: ZYNC_CONNECTIONS_DIR (the secrets folder), and GOOGLE_CLIENT_ID +
 * GOOGLE_CLIENT_SECRET for Google accounts (its redirect URI is APP_URL + GOOGLE_CALLBACK).
 */
export function connectionsFromEnv(env: NodeJS.ProcessEnv): ConnectionsOptions {
  const clientId = env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim()
  const appUrl = env.APP_URL?.replace(/\/$/, '')
  if (Boolean(clientId) !== Boolean(clientSecret))
    throw new Error('Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither')
  return {
    dir: path.resolve(env.ZYNC_CONNECTIONS_DIR || DEV_DIR),
    google:
      clientId && clientSecret && appUrl
        ? { clientId, clientSecret, redirectUri: `${appUrl}${GOOGLE_CALLBACK}` }
        : undefined,
  }
}
