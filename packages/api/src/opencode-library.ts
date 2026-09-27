import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  badRequest,
  conflict,
  errorMessage,
  notFound,
  parseFrontmatter,
  safeResolve,
  stringifyFrontmatter,
} from '@zync/jobs'

// opencode's config folder (next to opencode.json) holds the AI's agents, commands and skills as
// markdown files:
//
//   agents/<name>.md            frontmatter: description, mode, model, tools, permission… · body: the prompt
//   commands/<name>.md          frontmatter: description, agent, model… · body: the template ($ARGUMENTS)
//   skills/<name>/SKILL.md      frontmatter: name, description · body: instructions (+ any other files)
//
// opencode also accepts the singular folder names; both are listed. zync's own skills are copied into
// skills/ when the AI server starts (opencode/configure.mjs), so everything lives in this one folder;
// `builtinDir` is where the originals are, to tell whether a copy was changed and to reset it.

export const LIBRARY_KINDS = ['agent', 'command', 'skill'] as const
export type LibraryKind = (typeof LIBRARY_KINDS)[number]

const KIND_DIRS: Record<LibraryKind, string[]> = {
  agent: ['agents', 'agent'],
  command: ['commands', 'command'],
  skill: ['skills', 'skill'],
}
const TOP = new Set(Object.values(KIND_DIRS).flat())
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

export type LibraryItem = {
  kind: LibraryKind
  name: string
  /** The markdown file, relative to the config folder (e.g. "skills/kanban/SKILL.md"). */
  path: string
  description?: string
  /** A zync skill (it was copied from the app's own skills). */
  builtin?: boolean
  /** A zync skill whose copy differs from the app's version. */
  modified?: boolean
  /** Skills: the other files in the skill's folder, relative to the config folder. */
  files?: string[]
  mtime: number
  /** Frontmatter that doesn't parse. */
  error?: string
}

function describe(source: string): { description?: string; error?: string } {
  try {
    const d = parseFrontmatter(source).data as Record<string, unknown>
    return { description: typeof d.description === 'string' ? d.description : undefined }
  } catch (err) {
    return { error: errorMessage(err).split('\n')[0] }
  }
}

async function walkFiles(dir: string, rel = ''): Promise<string[]> {
  const out: string[] = []
  for (const d of await readdir(path.join(dir, rel), { withFileTypes: true }).catch(() => [])) {
    if (d.name.startsWith('.')) continue
    const r = rel ? `${rel}/${d.name}` : d.name
    if (d.isDirectory()) out.push(...(await walkFiles(dir, r)))
    else if (d.isFile()) out.push(r)
  }
  return out.toSorted()
}

async function sameTree(a: string, b: string): Promise<boolean> {
  const [fa, fb] = await Promise.all([walkFiles(a), walkFiles(b)])
  if (fa.join('\n') !== fb.join('\n')) return false
  for (const f of fa) {
    const [x, y] = await Promise.all([readFile(path.join(a, f)), readFile(path.join(b, f))])
    if (!x.equals(y)) return false
  }
  return true
}

export async function listLibrary(configDir: string, builtinDir?: string): Promise<LibraryItem[]> {
  const builtins = new Set(
    builtinDir
      ? (await readdir(builtinDir, { withFileTypes: true }).catch(() => []))
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
      : [],
  )
  const out: LibraryItem[] = []
  for (const kind of LIBRARY_KINDS) {
    for (const folder of KIND_DIRS[kind]) {
      const dir = path.join(configDir, folder)
      for (const d of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
        if (d.name.startsWith('.')) continue
        if (kind === 'skill') {
          if (!d.isDirectory()) continue
          const skillDir = path.join(dir, d.name)
          const file = path.join(skillDir, 'SKILL.md')
          const s = await stat(file).catch(() => null)
          const src = s ? await readFile(file, 'utf8') : ''
          const builtin = builtins.has(d.name) && !!builtinDir
          out.push({
            kind,
            name: d.name,
            path: `${folder}/${d.name}/SKILL.md`,
            ...(s ? describe(src) : { error: 'SKILL.md is missing' }),
            builtin: builtin || undefined,
            modified: builtin ? !(await sameTree(skillDir, path.join(builtinDir, d.name))) : undefined,
            files: (await walkFiles(skillDir)).filter((f) => f !== 'SKILL.md').map((f) => `${folder}/${d.name}/${f}`),
            mtime: s?.mtimeMs ?? 0,
          })
        } else if (d.isFile() && d.name.endsWith('.md')) {
          const file = path.join(dir, d.name)
          const [src, s] = await Promise.all([readFile(file, 'utf8'), stat(file)])
          out.push({ kind, name: d.name.slice(0, -3), path: `${folder}/${d.name}`, ...describe(src), mtime: s.mtimeMs })
        }
      }
    }
  }
  return out.toSorted((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
}

/** A path inside one of the library folders, resolved safely under the config folder. */
async function libraryPath(configDir: string, rel: string): Promise<string> {
  const clean = rel.replaceAll('\\', '/').replace(/^\/+/, '')
  const segs = clean.split('/')
  if (!TOP.has(segs[0] ?? '') || segs.length < 2 || segs.some((s) => !s || s === '..' || s.startsWith('.')))
    throw badRequest(`Not an agent, command or skill file: ${rel}`)
  await mkdir(configDir, { recursive: true })
  return safeResolve(configDir, clean)
}

export async function readLibraryFile(configDir: string, rel: string) {
  const file = await libraryPath(configDir, rel)
  const s = await stat(file).catch(() => null)
  if (!s?.isFile()) throw notFound(`No such file: ${rel}`)
  return { path: rel, mtime: s.mtimeMs, content: await readFile(file, 'utf8') }
}

/** Write a file (creating folders). With `baseMtime`, refuse to overwrite a newer version. */
export async function writeLibraryFile(configDir: string, rel: string, content: string, baseMtime?: number) {
  const file = await libraryPath(configDir, rel)
  const current = await stat(file).catch(() => null)
  if (current && baseMtime !== undefined && !Number.isNaN(baseMtime) && Math.abs(current.mtimeMs - baseMtime) > 1)
    throw Object.assign(conflict('The file changed on disk since you opened it'), { mtime: current.mtimeMs })
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, content)
  await rename(tmp, file)
  return { mtime: (await stat(file)).mtimeMs }
}

/** Delete a file, or a whole skill (`skills/<name>`). */
export async function deleteLibraryEntry(configDir: string, rel: string) {
  const target = await libraryPath(configDir, rel)
  const s = await stat(target).catch(() => null)
  if (!s) throw notFound(`No such file: ${rel}`)
  const segs = rel.split('/')
  if (s.isDirectory() && !(KIND_DIRS.skill.includes(segs[0] ?? '') && segs.length === 2))
    throw badRequest('Only a whole skill folder can be deleted')
  await rm(target, { recursive: true })
}

const TEMPLATES: Record<LibraryKind, (name: string, description: string) => string> = {
  agent: (_name, description) =>
    stringifyFrontmatter(
      { description, mode: 'subagent' },
      'You are … Describe the role, what to focus on, and how to answer.',
    ),
  command: (_name, description) => stringifyFrontmatter({ description }, 'Do … with: $ARGUMENTS'),
  skill: (name, description) =>
    stringifyFrontmatter({ name, description }, `# ${name}\n\nWhen and how to do it, step by step.`),
}

/** A new agent, command or skill from a starter template. Returns its markdown file path. */
export async function createLibraryItem(
  configDir: string,
  kind: LibraryKind,
  name: string,
  description = '',
): Promise<string> {
  if (!NAME_RE.test(name)) throw badRequest('Use lowercase letters, digits and dashes, e.g. "code-review"')
  const existing = await listLibrary(configDir)
  if (existing.some((i) => i.kind === kind && i.name === name)) throw conflict(`"${name}" already exists`)
  const rel = kind === 'skill' ? `skills/${name}/SKILL.md` : `${KIND_DIRS[kind][0]}/${name}.md`
  await writeLibraryFile(configDir, rel, TEMPLATES[kind](name, description || `What ${name} does and when to use it.`))
  return rel
}

/** Put a zync skill back to the app's version. */
export async function resetSkill(configDir: string, builtinDir: string | undefined, name: string) {
  if (!builtinDir || !NAME_RE.test(name)) throw notFound(`"${name}" is not a zync skill`)
  const from = path.join(builtinDir, name)
  if (!(await stat(from).catch(() => null))?.isDirectory()) throw notFound(`"${name}" is not a zync skill`)
  const to = await libraryPath(configDir, `skills/${name}`)
  await rm(to, { recursive: true, force: true })
  await cp(from, to, { recursive: true })
}
