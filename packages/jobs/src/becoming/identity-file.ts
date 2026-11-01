import { parseFrontmatter, stringifyFrontmatter } from '../frontmatter.js'
import { type Identity, IDENTITY_FIELDS, isIdentityField, type ProofLine } from './types.js'

// The body of an identity page is the user's "why", then the proof Zync appends, newest first:
//
//   ## Proof
//   - 2026-09-28 · 40 min in Writing/Essay.md · auto
//   - 2026-09-25 · small: one sentence · tap

export const PROOF_HEADING = '## Proof'

const PROOF_START = /^##\s+proof\s*$/i
const SECTION_END = /^#{1,2}\s/
const PROOF_LINE = /^\s*[-*]\s+(\d{4}-\d{2}-\d{2})\s+·\s+(.*?)(?:\s+·\s+([a-z]+))?\s*$/

/** Split a body into the why and the proof lines. */
export function splitProof(body: string): { why: string; proof: ProofLine[] } {
  const lines = body.split('\n')
  const start = lines.findIndex((l) => PROOF_START.test(l))
  if (start === -1) return { why: body.trim(), proof: [] }
  const rest = lines.slice(start + 1)
  const endAt = rest.findIndex((l) => SECTION_END.test(l))
  const section = endAt === -1 ? rest : rest.slice(0, endAt)
  const after = endAt === -1 ? [] : rest.slice(endAt)
  const proof: ProofLine[] = []
  for (const l of section) {
    const m = PROOF_LINE.exec(l)
    if (m?.[1] && m[2]) proof.push({ date: m[1], text: m[2], source: m[3] ?? '' })
  }
  const why = [...lines.slice(0, start), ...after].join('\n').trim()
  return { why, proof }
}

export const proofLine = (p: ProofLine) => `- ${p.date} · ${p.text}${p.source ? ` · ${p.source}` : ''}`

function joinBody(why: string, proof: ProofLine[]): string {
  if (proof.length === 0) return why
  const section = [PROOF_HEADING, ...proof.map(proofLine)].join('\n')
  return why ? `${why}\n\n${section}` : section
}

/** "writer.md" → "writer": what the identity is called when there is no statement. */
const nameOf = (file: string) => file.replace(/\.md$/, '')

/** Lenient: any page in Becoming/ is an identity. Invalid fields are kept in `extra`, never dropped. */
export function parseIdentity(file: string, source: string): Identity {
  let data: Record<string, unknown> = {}
  let content = source
  try {
    const parsed = parseFrontmatter(source)
    data = { ...parsed.data }
    content = parsed.content
  } catch {
    // Broken YAML: keep the whole file as the why rather than hiding the identity.
  }
  const { why, proof } = splitProof(content)
  const identity: Identity = {
    file,
    statement: `I am ${nameOf(file)}`,
    action: '',
    minutes: 30,
    signals: [],
    guards: [],
    stage: 'experiment',
    since: '',
    stageSince: '',
    why,
    proof,
    extra: {},
  }
  const fields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    const r = isIdentityField(k) ? IDENTITY_FIELDS[k].safeParse(v) : undefined
    if (r?.success) fields[k] = r.data
    else identity.extra[k] = v
  }
  Object.assign(identity, fields)
  if (!identity.stageSince) identity.stageSince = identity.since
  return identity
}

export function serializeIdentity(identity: Identity): string {
  const meta: Record<string, unknown> = {}
  for (const k of Object.keys(IDENTITY_FIELDS).filter(isIdentityField)) {
    const v = identity[k]
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue
    meta[k] = v
  }
  for (const [k, v] of Object.entries(identity.extra)) if (!(k in meta) && v !== undefined) meta[k] = v
  return stringifyFrontmatter(meta, joinBody(identity.why, identity.proof))
}
