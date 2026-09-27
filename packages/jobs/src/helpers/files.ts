import { access, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { notFound } from '../errors.js'
import { safeName } from './names.js'

export const exists = (p: string) =>
  access(p).then(
    () => true,
    () => false,
  )

/**
 * A markdown file name taken from a request: `x.md` directly inside its folder, not hidden.
 * Anything else is reported as an unknown `what` (404), never resolved on disk.
 */
export function checkMdFile(file: string, what: string): string {
  if (!file.endsWith('.md') || file.includes('/') || file.includes('\\') || file.startsWith('.')) {
    throw notFound(`Unknown ${what} "${file}"`)
  }
  return file
}

/** Names of the visible `.md` files directly inside `dir` (none when it doesn't exist). */
export async function listMdFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  return entries.filter((e) => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('.')).map((e) => e.name)
}

/** "Title.md", or "Title 2.md" … when taken (ignoring `current`, the file being renamed). */
export async function freeFileName(dir: string, title: string, current?: string): Promise<string> {
  const base = safeName(title)
  for (let i = 1; ; i++) {
    const file = i === 1 ? `${base}.md` : `${base} ${i}.md`
    if (file === current || !(await exists(path.join(dir, file)))) return file
  }
}

/** A JSON file's parsed content. Rejects when it is missing or malformed. */
export async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'))
}

/** Pretty-printed JSON with a trailing newline. */
export async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`)
}
