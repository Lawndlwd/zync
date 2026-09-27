import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { z } from 'zod'
import { safeName } from './boards.js'
import { listPeople, type Person } from './people.js'
import { workspacesRoot } from './workspaces.js'

// The AI's memory is plain markdown, like everything else in zync:
//
//   <root>/.zync/memory/<title>.md        remembered everywhere (global)
//   <ws>/.zync/memory/<title>.md          remembered in one workspace
//   <root>/.zync/people/<id>.md           what the AI knows about a person (@me = the user, @ai = itself)
//
// A memory's file name is its title; the frontmatter holds `type`, `description` (the one line shown
// in the index) and `pinned` (full text always in the prompt). The opencode plugin (opencode-plugin.ts)
// puts the people notes, the pinned memories and an index of the rest into every chat's system prompt,
// and gives the AI tools to read and write them. The Memory and People pages edit the same files.

export const MEMORY_TYPES = ['rule', 'preference', 'habit', 'fact'] as const
export type MemoryType = (typeof MEMORY_TYPES)[number]
export type MemoryScope = 'global' | 'workspace'

export interface Memory {
  /** File name inside the memory folder; the title is the name without `.md`. */
  file: string
  title: string
  scope: MemoryScope
  type?: MemoryType
  /** One line: what this memory is about. Shown in the index the AI always sees. */
  description?: string
  /** Always put the full text in the prompt (otherwise only the title and description are). */
  pinned: boolean
  /** Last write, ISO date-time (the file's mtime). */
  updated: string
  body: string
  /** Frontmatter keys we don't manage, preserved on write. */
  extra: Record<string, unknown>
}

export interface MemoryPatch {
  title?: string
  type?: MemoryType | null
  description?: string | null
  pinned?: boolean
  body?: string
}

const TypeSchema = z.enum(MEMORY_TYPES)
const notFound = (msg: string) => Object.assign(new Error(msg), { status: 404 })

export const globalMemoryDir = (root = workspacesRoot()) => path.join(root, '.zync', 'memory')
export const workspaceMemoryDir = (wsPath: string) => path.join(wsPath, '.zync', 'memory')
export const peopleNotesDir = (root = workspacesRoot()) => path.join(root, '.zync', 'people')

function checkFile(file: string): string {
  if (!file.endsWith('.md') || file.includes('/') || file.includes('\\') || file.startsWith('.')) {
    throw notFound(`Unknown memory "${file}"`)
  }
  return file
}

/** Accepts a title or a file name. */
export const memoryFile = (titleOrFile: string) => `${safeName(titleOrFile.trim().replace(/\.md$/i, ''))}.md`

export function parseMemory(file: string, source: string, scope: MemoryScope, updated: string): Memory {
  let data: Record<string, unknown> = {}
  let content = source
  try {
    const parsed = matter(source)
    data = { ...parsed.data }
    content = parsed.content
  } catch {
    // Broken YAML: keep the whole file as the body.
  }
  const { type, description, pinned, ...extra } = data
  const t = TypeSchema.safeParse(type)
  if (type !== undefined && !t.success) extra.type = type
  return {
    file,
    title: path.basename(file, '.md'),
    scope,
    type: t.success ? t.data : undefined,
    description: typeof description === 'string' && description.trim() ? description.trim() : undefined,
    pinned: pinned === true,
    updated,
    body: content.trim(),
    extra,
  }
}

export function serializeMemory(m: Pick<Memory, 'type' | 'description' | 'pinned' | 'body' | 'extra'>): string {
  const meta: Record<string, unknown> = {}
  if (m.type) meta.type = m.type
  if (m.description) meta.description = m.description
  if (m.pinned) meta.pinned = true
  for (const [k, v] of Object.entries(m.extra)) if (!(k in meta) && v !== undefined) meta[k] = v
  const body = m.body.trim() ? `\n${m.body.trim()}\n` : ''
  return Object.keys(meta).length ? matter.stringify(body, meta) : body.trimStart()
}

async function readOne(dir: string, file: string, scope: MemoryScope): Promise<Memory> {
  const full = path.join(dir, checkFile(file))
  const [src, st] = await Promise.all([readFile(full, 'utf8'), stat(full)]).catch(() => {
    throw notFound(`Unknown memory "${path.basename(file, '.md')}"`)
  })
  return parseMemory(file, src, scope, st.mtime.toISOString())
}

/** Pinned first, then the most recently updated. */
export async function listMemories(dir: string, scope: MemoryScope): Promise<Memory[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const files = entries.filter((e) => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('.'))
  const all = await Promise.all(files.map((e) => readOne(dir, e.name, scope).catch(() => null)))
  return all
    .filter((m): m is Memory => !!m)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated.localeCompare(a.updated))
}

export async function readMemory(dir: string, titleOrFile: string, scope: MemoryScope): Promise<Memory> {
  return readOne(dir, memoryFile(titleOrFile), scope)
}

function applyPatch(m: Memory, patch: MemoryPatch): Memory {
  const next = { ...m }
  if (patch.type !== undefined) next.type = patch.type === null ? undefined : TypeSchema.parse(patch.type)
  if (patch.description !== undefined) next.description = patch.description?.trim() || undefined
  if (patch.pinned !== undefined) next.pinned = !!patch.pinned
  if (patch.body !== undefined) next.body = patch.body
  return next
}

export async function createMemory(
  dir: string,
  scope: MemoryScope,
  input: MemoryPatch & { title: string },
): Promise<Memory> {
  const file = memoryFile(input.title)
  await mkdir(dir, { recursive: true })
  const blank: Memory = { file, title: '', scope, pinned: false, updated: '', body: '', extra: {} }
  const m = applyPatch(blank, input)
  await writeFile(path.join(dir, file), serializeMemory(m), { flag: 'wx' }).catch((err) => {
    if (err.code === 'EEXIST')
      throw Object.assign(new Error(`A memory called "${path.basename(file, '.md')}" already exists`), { status: 409 })
    throw err
  })
  return readOne(dir, file, scope)
}

export async function updateMemory(dir: string, scope: MemoryScope, file: string, patch: MemoryPatch): Promise<Memory> {
  const current = await readOne(dir, file, scope)
  let target = current.file
  if (patch.title !== undefined && memoryFile(patch.title) !== current.file) {
    target = memoryFile(patch.title)
    const taken = await stat(path.join(dir, target)).catch(() => null)
    if (taken && target.toLowerCase() !== current.file.toLowerCase())
      throw Object.assign(new Error(`A memory called "${path.basename(target, '.md')}" already exists`), {
        status: 409,
      })
    await rename(path.join(dir, current.file), path.join(dir, target))
  }
  await writeFile(path.join(dir, target), serializeMemory(applyPatch(current, patch)))
  return readOne(dir, target, scope)
}

/** Create, or update the memory with the same title. What the AI's memory_save tool does. */
export async function saveMemory(
  dir: string,
  scope: MemoryScope,
  input: MemoryPatch & { title: string },
): Promise<{ memory: Memory; created: boolean }> {
  const file = memoryFile(input.title)
  const exists = await stat(path.join(dir, file)).catch(() => null)
  if (!exists) return { memory: await createMemory(dir, scope, input), created: true }
  const { title: _, ...patch } = input
  return { memory: await updateMemory(dir, scope, file, patch), created: false }
}

export async function deleteMemory(dir: string, file: string): Promise<void> {
  const full = path.join(dir, checkFile(file))
  if (!(await stat(full).catch(() => null))) throw notFound(`Unknown memory "${path.basename(file, '.md')}"`)
  await rm(full)
}

// ── people notes ───────────────────────────────────────────────────────────

const PERSON_ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/

function personNotesPath(id: string, root: string): string {
  if (!PERSON_ID_RE.test(id)) throw notFound(`Unknown person "${id}"`)
  return path.join(peopleNotesDir(root), `${id}.md`)
}

export async function readPersonNotes(id: string, root = workspacesRoot()): Promise<string> {
  return (await readFile(personNotesPath(id, root), 'utf8').catch(() => '')).trim()
}

export async function writePersonNotes(id: string, notes: string, root = workspacesRoot()): Promise<string> {
  if (!(await listPeople(root)).some((p) => p.id === id)) throw notFound(`Unknown person "${id}"`)
  const file = personNotesPath(id, root)
  const text = notes.trim()
  if (!text) {
    await rm(file, { force: true })
    return ''
  }
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${text}\n`)
  return text
}

export async function deletePersonNotes(id: string, root = workspacesRoot()): Promise<void> {
  await rm(personNotesPath(id, root), { force: true })
}

/** A person by id, "@id" or name (case-insensitive). */
export async function findPerson(ref: string, root = workspacesRoot()): Promise<Person | undefined> {
  const key = ref.trim().replace(/^@/, '').toLowerCase()
  const people = await listPeople(root)
  return people.find((p) => p.id === key) ?? people.find((p) => p.name.toLowerCase() === key)
}

// ── what the AI sees ───────────────────────────────────────────────────────

/** Characters, not tokens (~4 per token). Keeps the prompt small even with a big memory. */
export const PROMPT_BUDGET = { person: 2500, pinned: 2500, total: 16000 }

export interface MemoryContext {
  root?: string
  /** The current workspace's folder, when the chat runs in one. */
  wsPath?: string
}

const clip = (text: string, max: number, hint: string) =>
  text.length <= max ? text : `${text.slice(0, max).trimEnd()}\n… (truncated: ${hint})`

const label = (m: Memory) => `${m.scope}${m.type ? ` · ${m.type}` : ''}`

async function collect(ctx: MemoryContext) {
  const root = ctx.root ?? workspacesRoot()
  const [people, global, local] = await Promise.all([
    listPeople(root),
    listMemories(globalMemoryDir(root), 'global'),
    ctx.wsPath ? listMemories(workspaceMemoryDir(ctx.wsPath), 'workspace') : Promise.resolve([]),
  ])
  const notes = await Promise.all(people.map(async (p) => ({ person: p, notes: await readPersonNotes(p.id, root) })))
  return { root, notes, memories: [...local, ...global] }
}

/**
 * The memory block added to the system prompt: instructions, people notes, pinned memories in full
 * and an index of the rest. Rebuilt on every request, so edits apply to the next message.
 */
export async function buildMemoryPrompt(ctx: MemoryContext = {}): Promise<string> {
  const { notes, memories } = await collect(ctx)
  const wsName = ctx.wsPath ? path.basename(ctx.wsPath) : undefined
  const out: string[] = [
    '<memory>',
    'You have a persistent memory shared by every chat and scheduled job in this app. The user reads and edits it on the Memory and People pages, so keep it clean and factual.',
    '',
    '- Apply what is below without being asked; rules and preferences are standing instructions from the user.',
    '- Save as you go with memory_save when you learn something durable: a preference or correction ("don\'t…", "always…", "from now on…"), how the user usually does a task, a recurring routine, a decision or fact about a project. Do not ask first; say it in one short line ("Saved to memory: …").',
    '- What you learn about a person (the user is @me) goes in their note with person_note, not in a memory.',
    '- One topic per memory. Update the existing memory (same title) instead of adding a near-duplicate; delete memories that turn out wrong.',
    '- Never save secrets, passwords or one-off task details, or what is already written in the workspace files.',
    wsName
      ? `- scope "workspace" = only the "${wsName}" workspace; scope "global" = everywhere.`
      : '- There is no current workspace: save with scope "global".',
  ]

  let used = 0
  const push = (s: string) => {
    out.push(s)
    used += s.length
  }

  const me = notes.find((n) => n.person.id === 'me')
  const ai = notes.find((n) => n.person.id === 'ai')
  if (me?.notes)
    push(
      `\n## About the user (@me, ${me.person.name})\n${clip(me.notes, PROMPT_BUDGET.person * 2, 'person_read "me"')}`,
    )
  if (ai?.notes)
    push(`\n## How the user wants you to work (@ai)\n${clip(ai.notes, PROMPT_BUDGET.person * 2, 'person_read "ai"')}`)

  const others = notes.filter((n) => !n.person.builtin)
  if (others.length) {
    push('\n## People')
    for (const { person, notes: text } of others) {
      const head = `### ${person.name} (@${person.id})`
      if (!text) push(`${head}\n(no notes yet)`)
      else if (used > PROMPT_BUDGET.total) push(`${head}\n(note not shown: person_read "${person.id}")`)
      else push(`${head}\n${clip(text, PROMPT_BUDGET.person, `person_read "${person.id}"`)}`)
    }
  }

  const pinned = memories.filter((m) => m.pinned)
  const rest = memories.filter((m) => !m.pinned)
  const shown: Memory[] = []
  if (pinned.length) {
    push('\n## Pinned memories')
    for (const m of pinned) {
      if (used > PROMPT_BUDGET.total) {
        rest.unshift(m)
        continue
      }
      shown.push(m)
      push(
        `### ${m.title} [${label(m)}]\n${clip(m.body || m.description || '', PROMPT_BUDGET.pinned, `memory_read "${m.title}"`)}`,
      )
    }
  }
  if (rest.length) {
    push('\n## Other memories (open with memory_read when relevant)')
    for (const m of rest) push(`- ${m.title} [${label(m)}]${m.description ? ` — ${m.description}` : ''}`)
  }
  if (!notes.some((n) => n.notes) && !memories.length)
    push('\n(Memory is empty so far. Start saving what you learn about the user and how they work.)')

  out.push('</memory>')
  return out.join('\n')
}

export interface MemoryHit {
  kind: 'memory' | 'person'
  title: string
  scope?: MemoryScope
  snippet: string
  score: number
}

/** Plain term search over memories and people notes. */
export async function searchMemory(query: string, ctx: MemoryContext = {}): Promise<MemoryHit[]> {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  const { notes, memories } = await collect(ctx)
  const docs = [
    ...memories.map((m) => ({
      kind: 'memory' as const,
      title: m.title,
      scope: m.scope,
      head: `${m.title} ${m.description ?? ''}`.toLowerCase(),
      text: m.body,
    })),
    ...notes
      .filter((n) => n.notes)
      .map((n) => ({
        kind: 'person' as const,
        title: `${n.person.name} (@${n.person.id})`,
        scope: undefined,
        head: `${n.person.name} ${n.person.id}`.toLowerCase(),
        text: n.notes,
      })),
  ]
  const hits: MemoryHit[] = []
  for (const d of docs) {
    const body = d.text.toLowerCase()
    let score = 0
    for (const t of terms) score += (d.head.includes(t) ? 3 : 0) + (body.includes(t) ? 1 : 0)
    if (!score) continue
    const lines = d.text.split('\n').filter((l) => terms.some((t) => l.toLowerCase().includes(t)))
    hits.push({
      kind: d.kind,
      title: d.title,
      scope: d.scope,
      snippet: (lines.slice(0, 3).join('\n') || d.text).slice(0, 400),
      score,
    })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 10)
}
