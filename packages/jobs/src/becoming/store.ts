import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { conflict, notFound } from '../errors.js'
import { localStamp } from '../helpers/dates.js'
import { checkMdFile, exists, listMdFiles } from '../helpers/files.js'
import { slugify } from '../helpers/names.js'
import { safeResolve } from '../workspaces.js'
import { parseIdentity, serializeIdentity } from './identity-file.js'
import {
  BECOMING_DIR,
  type Identity,
  type IdentityInput,
  IdentityInputSchema,
  type IdentityPatch,
  IdentityPatchSchema,
  type ProofLine,
} from './types.js'

export const becomingDir = (wsPath: string) => safeResolve(wsPath, BECOMING_DIR)

export const today = () => localStamp().slice(0, 10)

/** "I am a writer" → "writer", "I am someone who ships" → "someone-who-ships". */
export function identitySlug(statement: string): string {
  const rest = statement.replace(/^\s*i\s*(am|'m)\s+(an?\s+)?/i, '')
  return slugify(rest, 40, 'identity')
}

export async function listIdentities(wsPath: string): Promise<Identity[]> {
  const dir = await becomingDir(wsPath)
  const out: Identity[] = []
  for (const file of await listMdFiles(dir)) {
    const src = await readFile(path.join(dir, file), 'utf8').catch(() => null)
    if (src !== null) out.push(parseIdentity(file, src))
  }
  return out.toSorted((a, b) => a.since.localeCompare(b.since) || a.file.localeCompare(b.file))
}

export async function readIdentity(wsPath: string, file: string): Promise<Identity> {
  const dir = await becomingDir(wsPath)
  const src = await readFile(path.join(dir, checkMdFile(file, 'identity')), 'utf8').catch(() => {
    throw notFound(`Unknown identity "${file}"`)
  })
  return parseIdentity(file, src)
}

async function write(wsPath: string, identity: Identity): Promise<Identity> {
  const dir = await becomingDir(wsPath)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, checkMdFile(identity.file, 'identity')), serializeIdentity(identity))
  return identity
}

export async function createIdentity(wsPath: string, raw: IdentityInput, day = today()): Promise<Identity> {
  const input = IdentityInputSchema.parse(raw)
  const dir = await becomingDir(wsPath)
  const slug = identitySlug(input.statement)
  let file = `${slug}.md`
  for (let i = 2; await exists(path.join(dir, file)); i++) file = `${slug}-${i}.md`
  const stage = input.stage ?? 'experiment'
  if (stage === 'experiment' && (await listIdentities(wsPath)).some((i) => i.stage === 'experiment'))
    throw conflict('One experiment at a time: move the current one on (or let it go) first')
  return write(wsPath, {
    file,
    statement: input.statement,
    action: input.action,
    ...(input.small ? { small: input.small } : {}),
    ...(input.when ? { when: input.when } : {}),
    minutes: input.minutes ?? 30,
    signals: input.signals ?? [],
    guards: input.guards ?? [],
    stage,
    since: day,
    stageSince: day,
    why: input.why?.trim() ?? '',
    proof: [],
    extra: {},
  })
}

export function applyIdentityPatch(identity: Identity, raw: IdentityPatch, day = today()): Identity {
  const patch = IdentityPatchSchema.parse(raw)
  const next: Identity = { ...identity }
  if (patch.statement !== undefined) next.statement = patch.statement
  if (patch.action !== undefined) next.action = patch.action
  if (patch.small === null) delete next.small
  else if (patch.small !== undefined) next.small = patch.small
  if (patch.when === null) delete next.when
  else if (patch.when !== undefined) next.when = patch.when
  if (patch.minutes !== undefined) next.minutes = patch.minutes
  if (patch.signals !== undefined) next.signals = patch.signals
  if (patch.guards !== undefined) next.guards = patch.guards
  if (patch.stage !== undefined && patch.stage !== identity.stage) {
    next.stage = patch.stage
    next.stageSince = day
    delete next.quietUntil
  }
  if (patch.quietUntil === null) delete next.quietUntil
  else if (patch.quietUntil !== undefined) next.quietUntil = patch.quietUntil
  if (patch.why !== undefined) next.why = z.string().parse(patch.why).trim()
  const managed = Object.keys(patch)
  next.extra = Object.fromEntries(Object.entries(identity.extra).filter(([k]) => !managed.includes(k)))
  return next
}

export async function updateIdentity(wsPath: string, file: string, patch: IdentityPatch): Promise<Identity> {
  return write(wsPath, applyIdentityPatch(await readIdentity(wsPath, file), patch))
}

const proofKey = (p: ProofLine) => `${p.date}|${p.source}`

/**
 * Add proof lines (newest first), skipping any already there. One line per day and source: a newer
 * line for the same day and source replaces the older one (a tap after an auto vote, say).
 */
export async function appendProof(wsPath: string, file: string, lines: ProofLine[]): Promise<Identity> {
  const identity = await readIdentity(wsPath, file)
  const incoming = new Set(lines.map(proofKey))
  const proof = [...lines, ...identity.proof.filter((p) => !incoming.has(proofKey(p)))].toSorted((a, b) =>
    b.date.localeCompare(a.date),
  )
  return write(wsPath, { ...identity, proof })
}

/** Drop the proof lines of a day that the user cast (an undone vote); Zync's own lines stay. */
export async function removeProof(wsPath: string, file: string, date: string): Promise<Identity> {
  const identity = await readIdentity(wsPath, file)
  return write(wsPath, { ...identity, proof: identity.proof.filter((p) => p.date !== date || p.source === 'auto') })
}

export async function deleteIdentity(wsPath: string, file: string): Promise<void> {
  await readIdentity(wsPath, file)
  await rm(path.join(await becomingDir(wsPath), file))
}
