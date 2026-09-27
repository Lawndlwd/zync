import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { workspacesRoot } from '@zync/jobs'

import { createApp } from './app.js'
import { authConfigFromEnv } from './auth/config.js'
import { guardUpgrade } from './auth/guard.js'
import { Auth } from './auth/service.js'
import { opencodeUpgrade } from './opencode-proxy.js'
import { isAppPath } from './spa.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT || 3001)
const root = workspacesRoot()
const opencodeUrl = process.env.OPENCODE_URL || 'http://127.0.0.1:4096'

// Sign-in is always on. The only way around it is ZYNC_INSECURE_DEV=1, refused in production and
// then only listening on this machine.
const insecure = process.env.ZYNC_INSECURE_DEV === '1'
if (insecure && process.env.NODE_ENV === 'production') {
  console.error('[api] ZYNC_INSECURE_DEV is not allowed in production')
  process.exit(1)
}
const auth = insecure ? undefined : new Auth(authConfigFromEnv(process.env))

const app = createApp({
  workspacesRoot: root,
  opencodeUrl,
  webDist: process.env.WEB_DIST || path.resolve(here, '../../web/dist'),
  // Docker mounts opencode's config volume into the api container; dev uses scripts/dev-opencode.sh's file.
  opencodeConfigPath:
    process.env.ZYNC_OPENCODE_CONFIG || path.resolve(here, '../../../data/opencode/config/opencode/opencode.json'),
  opencodeSkillsDir: process.env.ZYNC_SKILLS_DIR || path.resolve(here, '../../../opencode/skills'),
  ...(auth ? { auth } : {}),
})

const setupCode = auth ? await auth.newSetupCode() : null
const host = insecure ? '127.0.0.1' : '0.0.0.0'
const server = app.listen(port, host, () => {
  console.log(`[api] listening on ${host}:${port}, workspaces root ${root}, opencode ${opencodeUrl}`)
  if (insecure) console.warn('[api] ZYNC_INSECURE_DEV: no sign-in, localhost only')
  else console.log(`[api] sign-in on for ${auth?.cfg.origin}${auth?.cfg.cfAccess ? ' behind Cloudflare Access' : ''}`)
  if (setupCode) {
    console.log(
      `\n  No passkey yet. Open ${auth?.cfg.origin}/login and enter this one-time setup code (valid 1 hour):\n\n      ${setupCode}\n`,
    )
  }
})
const upgrade = opencodeUpgrade(opencodeUrl, isAppPath)
server.on('upgrade', auth ? guardUpgrade(auth, upgrade) : upgrade)
