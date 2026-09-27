import { createHash } from 'node:crypto'
import path from 'node:path'

import { notFound } from '../errors.js'
import { slugify } from '../helpers/names.js'
import { safeResolve } from '../workspaces.js'

export function cleanBoardPath(boardPath: string): string {
  const rel = boardPath.replaceAll('\\', '/').replaceAll(/^\/+|\/+$/g, '')
  if (!rel || rel.split('/').some((seg) => !seg || seg === '.' || seg === '..' || seg.startsWith('.'))) {
    throw notFound(`Unknown board "${boardPath}"`)
  }
  return rel
}

export async function boardDir(wsPath: string, boardPath: string): Promise<string> {
  return safeResolve(wsPath, cleanBoardPath(boardPath))
}

/** Workspace-relative path of a card file; this is what a linked job points at. */
export const cardRef = (boardPath: string, file: string) => `${cleanBoardPath(boardPath)}/${file}`

/** Stable, valid job name for a card path (job names are kebab-case, ≤ 64 chars). */
export function cardJobName(ref: string): string {
  const base = slugify(path.posix.basename(ref, '.md'), 40, '')
  const hash = createHash('sha1').update(ref).digest('hex').slice(0, 8)
  return `card-${base ? `${base}-` : ''}${hash}`
}
