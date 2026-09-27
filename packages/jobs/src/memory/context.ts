import { globalMemoryDir, workspaceMemoryDir } from '../helpers/paths.js'
import { readPersonNotes } from '../people/notes.js'
import { listPeople } from '../people/people.js'
import { workspacesRoot } from '../workspaces.js'
import { listMemories } from './store.js'

export type MemoryContext = {
  root?: string
  /** The current workspace's folder, when the chat runs in one. */
  wsPath?: string
}

/** Everything the AI may remember in this context: people notes and the global + workspace memories. */
export async function collectMemory(ctx: MemoryContext) {
  const root = ctx.root ?? workspacesRoot()
  const [people, global, local] = await Promise.all([
    listPeople(root),
    listMemories(globalMemoryDir(root), 'global'),
    ctx.wsPath ? listMemories(workspaceMemoryDir(ctx.wsPath), 'workspace') : Promise.resolve([]),
  ])
  const notes = await Promise.all(people.map(async (p) => ({ person: p, notes: await readPersonNotes(p.id, root) })))
  return { root, notes, memories: [...local, ...global] }
}
