import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { badRequest, notFound } from '../errors.js'
import { readJson, writeJson } from '../helpers/files.js'
import { slugify } from '../helpers/names.js'
import { peopleNotesDir, peoplePath } from '../helpers/paths.js'
import { workspacesRoot } from '../workspaces.js'

// People are global: one list in <root>/.zync/people.json shared by every workspace.
// "me" and "ai" always exist; "ai" cards are executed by the scheduler.

export const PersonSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/),
  name: z.string().trim().min(1).max(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
})

export type Person = z.infer<typeof PersonSchema> & { builtin?: boolean }

export const BUILTIN_PEOPLE: Person[] = [
  { id: 'me', name: 'Me', color: '#2f6feb', builtin: true },
  { id: 'ai', name: 'AI', color: '#8b5cf6', builtin: true },
]

const isBuiltin = (id: string) => BUILTIN_PEOPLE.some((p) => p.id === id)

async function readStored(root: string): Promise<Person[]> {
  const raw = await readJson(peoplePath(root)).catch(() => [])
  return (Array.isArray(raw) ? raw : []).flatMap((p) => {
    const r = PersonSchema.safeParse(p)
    return r.success ? [r.data] : []
  })
}

async function writeStored(root: string, people: Person[]): Promise<void> {
  const file = peoplePath(root)
  await mkdir(path.dirname(file), { recursive: true })
  const stored = people.map(({ builtin: _, ...p }) => p)
  await writeJson(file, stored)
}

/** Builtins first (with any stored name/color overrides), then the rest by name. */
export async function listPeople(root = workspacesRoot()): Promise<Person[]> {
  const stored = await readStored(root)
  const builtins = BUILTIN_PEOPLE.map((b) => ({ ...b, ...stored.find((p) => p.id === b.id), builtin: true }))
  const others = stored.filter((p) => !isBuiltin(p.id)).toSorted((a, b) => a.name.localeCompare(b.name))
  return [...builtins, ...others]
}

export async function createPerson(input: { name: string; color?: string }, root = workspacesRoot()): Promise<Person> {
  const stored = await readStored(root)
  const taken = new Set([...BUILTIN_PEOPLE, ...stored].map((p) => p.id))
  const base = slugify(input.name, 28)
  let id = base
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`
  const person = PersonSchema.parse({ id, name: input.name, color: input.color })
  await writeStored(root, [...stored, person])
  return person
}

export async function updatePerson(
  id: string,
  patch: { name?: string; color?: string },
  root = workspacesRoot(),
): Promise<Person> {
  const stored = await readStored(root)
  const current = (await listPeople(root)).find((p) => p.id === id)
  if (!current) throw notFound(`Unknown person "${id}"`)
  const { builtin, ...rest } = current
  const next = PersonSchema.parse({ ...rest, name: patch.name ?? rest.name, color: patch.color ?? rest.color, id })
  await writeStored(root, [...stored.filter((p) => p.id !== id), next])
  return { ...next, builtin }
}

export async function deletePerson(id: string, root = workspacesRoot()): Promise<void> {
  if (isBuiltin(id)) throw badRequest(`"@${id}" is built in and cannot be deleted`)
  const stored = await readStored(root)
  if (!stored.some((p) => p.id === id)) throw notFound(`Unknown person "${id}"`)
  await writeStored(
    root,
    stored.filter((p) => p.id !== id),
  )
  // Their memory note (see notes.ts).
  await rm(path.join(peopleNotesDir(root), `${id}.md`), { force: true })
}
