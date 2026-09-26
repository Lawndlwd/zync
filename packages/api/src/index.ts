import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { workspacesRoot } from '@zync/jobs'
import { createApp } from './app.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT || 3001)
const root = workspacesRoot()

const app = createApp({
  workspacesRoot: root,
  chatUrl: process.env.CHAT_URL || 'http://127.0.0.1:4096',
  webDist: process.env.WEB_DIST || path.resolve(here, '../../web/dist'),
})

app.listen(port, () => {
  console.log(`[api] listening on :${port}, workspaces root ${root}`)
})
