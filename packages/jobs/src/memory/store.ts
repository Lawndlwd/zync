import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { codeOf, conflict, notFound } from '../errors.js'
import { checkMdFile, listMdFiles } from '../helpers/files.js'
import { memoryFile, parseMemory, serializeMemory } from './memory-file.js'
import { type Memory, type MemoryPatch, type MemoryScope, TypeSchema } from './types.js'

async function readOne(dir: string, file: string, scope: MemoryScope): Promise<Memory> {
  const full = path.join(dir, checkMdFile(file, 'memory'))
  const [src, st] = await Promise.all([readFile(full, 'utf8'), stat(full)]).catch(() => {
    throw notFound(`Unknown memory "${path.basename(file, '.md')}"`)
  })
  return parseMemory(file, src, scope, st.mtime.toISOString())
}

/** Pinned first, then the most recently updated. */
export async function listMemories(dir: string, scope: MemoryScope): Promise<Memory[]> {
  const files = await listMdFiles(dir)
  const all = await Promise.all(files.map((file) => readOne(dir, file, scope).catch(() => null)))
  return all
    .filter((m): m is Memory => !!m)
    .toSorted((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated.localeCompare(a.updated))
}

export async function readMemory(dir: string, titleOrFile: string, scope: MemoryScope): Promise<Memory> {
  return readOne(dir, memoryFile(titleOrFile), scope)
}

function applyPatch(m: Memory, patch: MemoryPatch): Memory {
  const next = { ...m }
  if (patch.type !== undefined) next.type = patch.type === null ? undefined : TypeSchema.parse(patch.type)
  if (patch.description !== undefined) next.description = patch.description?.trim() || undefined
  if (patch.pinned !== undefined) next.pinned = patch.pinned
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
  await writeFile(path.join(dir, file), serializeMemory(m), { flag: 'wx' }).catch((err: unknown) => {
    if (codeOf(err) === 'EEXIST') throw conflict(`A memory called "${path.basename(file, '.md')}" already exists`)
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
      throw conflict(`A memory called "${path.basename(target, '.md')}" already exists`)
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
  const full = path.join(dir, checkMdFile(file, 'memory'))
  if (!(await stat(full).catch(() => null))) throw notFound(`Unknown memory "${path.basename(file, '.md')}"`)
  await rm(full)
}
