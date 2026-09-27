import path from 'node:path'

import { workspacesRoot } from '../workspaces.js'

// zync's own data lives in hidden `.zync` folders: global ones under the workspaces root, per-workspace
// ones inside the workspace.

const zyncDir = (dir: string) => path.join(dir, '.zync')

export const peoplePath = (root = workspacesRoot()) => path.join(zyncDir(root), 'people.json')
export const peopleNotesDir = (root = workspacesRoot()) => path.join(zyncDir(root), 'people')
export const globalMemoryDir = (root = workspacesRoot()) => path.join(zyncDir(root), 'memory')
export const workspaceMemoryDir = (wsPath: string) => path.join(zyncDir(wsPath), 'memory')
export const treeOrderPath = (wsPath: string) => path.join(zyncDir(wsPath), 'order.json')
