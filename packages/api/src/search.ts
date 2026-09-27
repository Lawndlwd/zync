import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { isBinaryFile } from './helpers/binary.js'

// Full-text search over a workspace's files, for the ⌘K palette. Matching ignores case and accents
// ("resume" finds "Résumé") and treats words as prefixes ("schedul" finds "scheduling"). Ranking, best
// first: the whole query as a phrase · all words on one line · all words in the file · most words.

export type WorkspaceFile = {
  name: string
  path: string
  size: number
  mtime: number
}

const SKIP_DIRS = new Set(['.git', 'node_modules'])
const MAX_FILES = 5000
const MAX_SEARCH_BYTES = 1024 * 1024

/** Every visible file under `root` (dotfiles and dot-folders skipped), depth-limited. */
async function listFiles(root: string, maxDepth = 8): Promise<WorkspaceFile[]> {
  const out: WorkspaceFile[] = []
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > maxDepth || out.length >= MAX_FILES) return
    const dirents = (await readdir(dir, { withFileTypes: true }).catch(() => [])).filter(
      (d) => !SKIP_DIRS.has(d.name) && !d.name.startsWith('.'),
    )
    // One folder's files are stat'ed together; subfolders are walked one after the other.
    const files = dirents.filter((d) => d.isFile())
    const stats = await Promise.all(files.map((d) => stat(path.join(dir, d.name)).catch(() => null)))
    for (const [i, s] of stats.entries()) {
      const d = files[i]
      if (!s || !d || out.length >= MAX_FILES) continue
      out.push({
        name: d.name,
        path: path.relative(root, path.join(dir, d.name)).split(path.sep).join('/'),
        size: s.size,
        mtime: s.mtimeMs,
      })
    }
    for (const d of dirents) if (d.isDirectory()) await walk(path.join(dir, d.name), depth + 1)
  }
  await walk(root, 0)
  return out
}

const listed = new Map<string, { version: number; files: Promise<WorkspaceFile[]> }>()

/**
 * listFiles, reused while the workspace's change counter (`version`) stays the same. Without one
 * (nobody watches the workspace) it always walks. Treat the result as read-only.
 */
export function listFilesCached(root: string, version: number | undefined): Promise<WorkspaceFile[]> {
  if (version === undefined) {
    listed.delete(root)
    return listFiles(root)
  }
  const hit = listed.get(root)
  if (hit?.version === version) return hit.files
  const files = listFiles(root)
  listed.set(root, { version, files })
  return files
}

/** Lowercase, accents removed. Keeps one output char per input char for precomposed text. */
function fold(s: string): string {
  return s.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase()
}

export function queryWords(query: string): string[] {
  const words = fold(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2 || /\d/.test(w))
  return [...new Set(words)]
}

type Snippet = {
  line: number
  text: string
}

export type Hit = {
  score: number
  snippets: Snippet[]
}

const SNIPPET_BEFORE = 60
const SNIPPET_AFTER = 120

function snippet(line: string, at: number): string {
  const start = Math.max(0, at - SNIPPET_BEFORE)
  const end = Math.min(line.length, at + SNIPPET_AFTER)
  return `${start > 0 ? '…' : ''}${line.slice(start, end).trim()}${end < line.length ? '…' : ''}`
}

/** Score one file against the query; null when it doesn't match well enough. */
export function scoreFile(query: string, filePath: string, content: string): Hit | null {
  const phrase = fold(query).replaceAll(/\s+/g, ' ').trim()
  const words = queryWords(query)
  if (!phrase) return null
  const terms = words.length ? words : [phrase]

  const lines = content.split('\n')
  const folded = lines.map(fold)
  // A sentence may wrap onto the next line, but not across a paragraph break (blank line).
  const flat = folded
    .join('\n')
    .replaceAll(/\n\s*\n/g, ' \u241E ')
    .replaceAll(/\s+/g, ' ')
  const multiWord = terms.length > 1

  const phraseCount = multiWord ? flat.split(phrase).length - 1 : 0
  const inFile = terms.filter((w) => flat.includes(w))
  const name = fold(filePath)
  const inName = terms.filter((w) => name.includes(w))

  // Most of the words must appear (in the text or the file's path), or the phrase itself.
  const need = Math.ceil(terms.length * 0.6)
  if (!phraseCount && inFile.length < need && new Set([...inFile, ...inName]).size < terms.length) return null
  if (!phraseCount && !inFile.length && inName.length < terms.length) return null

  const perLine = folded.map((l) => terms.filter((w) => l.includes(w)).length)
  const bestCount = Math.max(0, ...perLine)

  const score =
    (phraseCount ? 100 + 10 * Math.min(phraseCount, 5) : 0) +
    40 * (inFile.length / terms.length) +
    25 * (bestCount / terms.length) +
    (bestCount === terms.length && multiWord ? 15 : 0) +
    30 * (inName.length / terms.length)

  // Up to two lines: those with the phrase first, then those with the most words.
  const order = folded
    .map((l, i) => ({ i, l, phrase: multiWord && l.includes(phrase), n: perLine[i] ?? 0 }))
    .filter((x) => x.phrase || x.n > 0)
    .toSorted((a, b) => Number(b.phrase) - Number(a.phrase) || b.n - a.n || a.i - b.i)
    .slice(0, 2)
  const snippets = order.map(({ i, l, phrase: hasPhrase }) => {
    const at = hasPhrase ? l.indexOf(phrase) : Math.min(...terms.map((w) => l.indexOf(w)).filter((x) => x >= 0))
    return { line: i + 1, text: snippet(lines[i] ?? '', at) }
  })

  return { score, snippets }
}

export type SearchResult = {} & WorkspaceFile & Hit

export async function searchWorkspace(root: string, query: string, limit = 20): Promise<SearchResult[]> {
  if (fold(query).trim().length < 2) return []
  const results: SearchResult[] = []
  for (const f of await listFiles(root)) {
    let content = ''
    if (f.size <= MAX_SEARCH_BYTES) {
      const full = path.join(root, f.path)
      if (!(await isBinaryFile(full, 4096).catch(() => true))) content = await readFile(full, 'utf8').catch(() => '')
    }
    const hit = scoreFile(query, f.path, content)
    if (hit) results.push({ ...f, ...hit })
  }
  return results.toSorted((a, b) => b.score - a.score || b.mtime - a.mtime).slice(0, limit)
}
