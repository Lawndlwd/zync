import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { workspacesRoot } from '@zync/jobs'
import { createApp, isAppPath } from './app.js'
import { opencodeUpgrade } from './opencode-proxy.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT || 3001)
const root = workspacesRoot()
const opencodeUrl = process.env.OPENCODE_URL || 'http://127.0.0.1:4096'

const app = createApp({
  workspacesRoot: root,
  opencodeUrl,
  webDist: process.env.WEB_DIST || path.resolve(here, '../../web/dist'),
  // Docker mounts opencode's config volume into the api container; dev uses scripts/dev-opencode.sh's file.
  opencodeConfigPath:
    process.env.ZYNC_OPENCODE_CONFIG || path.resolve(here, '../../../data/opencode/config/opencode/opencode.json'),
})

const server = app.listen(port, () => {
  console.log(`[api] listening on :${port}, workspaces root ${root}, opencode ${opencodeUrl}`)
})
server.on('upgrade', opencodeUpgrade(opencodeUrl, isAppPath))
