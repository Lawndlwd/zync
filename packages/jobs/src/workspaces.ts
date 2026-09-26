import { mkdir, readdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface Workspace {
  name: string
  path: string
}

// Local dev fallback: <repo>/data/workspaces (same as scripts/dev-opencode.sh).
// Docker sets WORKSPACES_ROOT=/workspace explicitly.
const DEV_ROOT = fileURLToPath(new URL('../../../data/workspaces', import.meta.url))

export function workspacesRoot(): string {
  return path.resolve(process.env.WORKSPACES_ROOT || DEV_ROOT)
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._ -]*$/

export function isValidWorkspaceName(name: string): boolean {
  return NAME_RE.test(name) && !name.includes('..')
}

/** Every visible subdirectory of the root is a workspace. */
export async function listWorkspaces(root = workspacesRoot()): Promise<Workspace[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, path: path.join(root, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Accepts a workspace name or an absolute path inside the root. */
export async function resolveWorkspace(nameOrPath: string, root = workspacesRoot()): Promise<Workspace> {
  let name = nameOrPath.trim()
  if (path.isAbsolute(name)) {
    const rel = path.relative(root, name)
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`Path is not inside the workspaces root (${root}): ${nameOrPath}`)
    }
    name = rel.split(path.sep)[0]
  }
  if (!isValidWorkspaceName(name)) throw new Error(`Invalid workspace name: ${nameOrPath}`)
  const wsPath = path.join(root, name)
  const s = await stat(wsPath).catch(() => null)
  if (!s?.isDirectory()) {
    const known = (await listWorkspaces(root)).map((w) => w.name).join(', ') || '(none)'
    throw new Error(`Unknown workspace "${name}". Known workspaces: ${known}`)
  }
  return { name, path: wsPath }
}

export async function createWorkspace(name: string, root = workspacesRoot()): Promise<Workspace> {
  if (!isValidWorkspaceName(name)) throw new PathError(`Invalid workspace name: ${name}`)
  const wsPath = path.join(root, name)
  await mkdir(wsPath, { recursive: true })
  return { name, path: wsPath }
}

/**
 * Resolve a user-supplied relative path inside a workspace. Rejects traversal and
 * symlinks that escape the workspace (checked on the nearest existing ancestor).
 */
export async function safeResolve(wsPath: string, rel: string): Promise<string> {
  const cleaned = (rel || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const target = path.resolve(wsPath, cleaned)
  if (target !== wsPath && !target.startsWith(wsPath + path.sep)) {
    throw new PathError(`Path escapes workspace: ${rel}`)
  }
  const realRoot = await realpath(wsPath)
  let probe = target
  while (true) {
    const real = await realpath(probe).catch(() => null)
    if (real) {
      if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
        throw new PathError(`Path escapes workspace via symlink: ${rel}`)
      }
      break
    }
    const parent = path.dirname(probe)
    if (parent === probe) break
    probe = parent
  }
  return target
}

export class PathError extends Error {
  status = 400
}
