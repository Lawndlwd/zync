import { readdir } from 'node:fs/promises'
import path from 'node:path'

import { codeOf, notFound } from '../errors.js'
import { readJson, writeJson } from '../helpers/files.js'
import { boardDir, cleanBoardPath } from './refs.js'
import { type Board, BOARD_FILE, BoardFileSchema, type Column } from './types.js'

const SCAN_DEPTH = 3
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build'])

export async function readBoardFile(dir: string): Promise<Column[]> {
  return BoardFileSchema.parse(await readJson(path.join(dir, BOARD_FILE))).columns
}

export async function writeBoardFile(dir: string, columns: Column[]): Promise<void> {
  await writeJson(path.join(dir, BOARD_FILE), BoardFileSchema.parse({ columns }))
}

export async function readBoardMeta(wsPath: string, boardPath: string): Promise<Board> {
  const rel = cleanBoardPath(boardPath)
  const dir = await boardDir(wsPath, rel)
  const columns = await readBoardFile(dir).catch((err: unknown) => {
    if (codeOf(err) === 'ENOENT' || codeOf(err) === 'ENOTDIR') throw notFound(`"${rel}" is not a board`)
    throw err
  })
  return { path: rel, name: path.posix.basename(rel), columns }
}

/** Every folder (up to a few levels deep) that has a `.board.json`. */
export async function listBoards(wsPath: string): Promise<Board[]> {
  const out: Board[] = []
  const walk = async (rel: string, depth: number) => {
    const dir = rel ? path.join(wsPath, rel) : wsPath
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    if (rel && entries.some((e) => e.isFile() && e.name === BOARD_FILE)) {
      const columns = await readBoardFile(dir).catch(() => null)
      if (columns) out.push({ path: rel, name: path.posix.basename(rel), columns })
    }
    if (depth >= SCAN_DEPTH) return
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name)) {
        await walk(rel ? `${rel}/${e.name}` : e.name, depth + 1)
      }
    }
  }
  await walk('', 0)
  return out.toSorted((a, b) => a.path.localeCompare(b.path))
}
