import { type FSWatcher, watch } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { type Board, firstColumn, listBoards, listCards, parseCard } from '../boards/index.js'
import { errorMessage } from '../errors.js'
import { localStamp } from '../helpers/dates.js'
import type { Workspace } from '../workspaces.js'
import { appendActivity, isWorkPath } from './activity.js'
import type { Log } from './daily.js'
import type { Activity } from './types.js'

type Watched = {
  ws: Workspace
  watcher: FSWatcher
  /** Board folder → board, refreshed when a `.board.json` changes. */
  boards: Map<string, Board>
  /** Card path → its column, to tell a move from an edit. */
  status: Map<string, string>
  /** Path → the minute it was last logged: one line per file per minute. */
  logged: Map<string, string>
}

/** Read every board and its cards' columns; the maps are swapped in at once, never seen half-filled. */
async function loadBoards(wsPath: string, boards: Map<string, Board>, status: Map<string, string>): Promise<void> {
  const nextBoards = new Map<string, Board>()
  const nextStatus = new Map<string, string>()
  for (const b of await listBoards(wsPath)) {
    nextBoards.set(b.path, b)
    for (const c of await listCards(wsPath, b.path)) nextStatus.set(`${b.path}/${c.file}`, c.status ?? firstColumn(b))
  }
  boards.clear()
  for (const [k, v] of nextBoards) boards.set(k, v)
  for (const [k, v] of nextStatus) if (!status.has(k)) status.set(k, v)
}

/** Watches every workspace and appends what the user edits (and which cards move) to its activity log. */
export class ActivityRecorder {
  private watched = new Map<string, Watched>()

  constructor(private log: Log = () => {}) {}

  /** Start watching new workspaces, stop watching removed ones. */
  async sync(workspaces: Workspace[]): Promise<void> {
    const names = new Set(workspaces.map((w) => w.name))
    for (const [name, w] of this.watched) {
      if (names.has(name)) continue
      w.watcher.close()
      this.watched.delete(name)
    }
    for (const ws of workspaces) {
      if (this.watched.has(ws.name)) continue
      try {
        await this.watch(ws)
      } catch (err) {
        this.log(`activity: cannot watch ${ws.name}: ${errorMessage(err)}`)
      }
    }
  }

  stop(): void {
    for (const w of this.watched.values()) w.watcher.close()
    this.watched.clear()
  }

  private async watch(ws: Workspace): Promise<void> {
    const boards = new Map<string, Board>()
    const status = new Map<string, string>()
    await loadBoards(ws.path, boards, status)
    const w: Watched = {
      ws,
      boards,
      status,
      logged: new Map(),
      watcher: watch(ws.path, { recursive: true }, (_event, name) => {
        if (name) void this.onChange(w, name.split(path.sep).join('/'))
      }),
    }
    w.watcher.on('error', () => {})
    this.watched.set(ws.name, w)
  }

  private async onChange(w: Watched, rel: string): Promise<void> {
    if (rel.endsWith('/.board.json')) return loadBoards(w.ws.path, w.boards, w.status)
    if (!isWorkPath(rel)) return
    // Folders change when a file inside them does; deleted files are not work.
    const st = await stat(path.join(w.ws.path, rel)).catch(() => null)
    if (!st?.isFile()) {
      if (!st) w.status.delete(rel)
      return
    }
    const t = localStamp()
    const lines: Activity[] = []
    if (w.logged.get(rel) !== t) {
      w.logged.set(rel, t)
      lines.push({ t, path: rel, kind: 'edit' })
    }
    const card = await this.cardMove(w, rel)
    if (card) lines.push({ t, path: rel, ...card })
    await appendActivity(w.ws.path, lines).catch((err: unknown) =>
      this.log(`activity: cannot write: ${errorMessage(err)}`),
    )
  }

  /** A card whose column changed: done (the board's last column) or moved. */
  private async cardMove(w: Watched, rel: string): Promise<Pick<Activity, 'kind' | 'labels'> | null> {
    const board = w.boards.get(path.posix.dirname(rel))
    if (!board || !rel.endsWith('.md')) return null
    const src = await readFile(path.join(w.ws.path, rel), 'utf8').catch(() => null)
    if (src === null) {
      w.status.delete(rel)
      return null
    }
    const card = parseCard(path.posix.basename(rel), src)
    const now = card.status ?? firstColumn(board)
    const was = w.status.get(rel)
    w.status.set(rel, now)
    if (was === undefined || was === now) return null
    const done = board.columns.at(-1)?.id === now
    return { kind: done ? 'card-done' : 'card-moved', labels: card.labels }
  }
}
