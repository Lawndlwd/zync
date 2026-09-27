import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { notFound } from '../errors.js'
import { peopleNotesDir } from '../helpers/paths.js'
import { workspacesRoot } from '../workspaces.js'
import { listPeople, type Person } from './people.js'

// What the AI knows about a person: <root>/.zync/people/<id>.md (@me = the user, @ai = itself).

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

/** A person by id, "@id" or name (case-insensitive). */
export async function findPerson(ref: string, root = workspacesRoot()): Promise<Person | undefined> {
  const key = ref.trim().replace(/^@/, '').toLowerCase()
  const people = await listPeople(root)
  return people.find((p) => p.id === key) ?? people.find((p) => p.name.toLowerCase() === key)
}
