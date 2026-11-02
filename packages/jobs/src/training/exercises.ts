import { badRequest, notFound } from '../errors.js'
import { catalog, catalogExercise } from './catalog.js'
import { customSlug, listCustomExercises, readCustomExercise } from './custom-exercises.js'
import type { Exercise } from './types.js'

/** Lowercase words, accents and punctuation gone: "Pull-up (Neutral)" → ["pull", "up", "neutral"]. */
const words = (s: string) =>
  s
    .normalize('NFKD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w !== '')

/** How well `name` answers the query words; 0 = not at all. */
function score(e: Exercise, query: string[]): number {
  if (query.length === 0) return 1
  const name = words(e.name)
  const compact = name.join('')
  const q = query.join(' ')
  if (name.join(' ') === q) return 100
  const inName = query.filter((w) => compact.includes(w)).length
  const elsewhere = query.filter((w) =>
    [e.muscleGroup, e.equipment, e.target ?? '', ...e.secondary].some((f) => words(f).join('').includes(w)),
  ).length
  if (inName === query.length) return (name.join(' ').startsWith(q) ? 60 : 40) - name.length
  if (inName + elsewhere >= query.length) return 10 + inName - name.length / 100
  return 0
}

/** The user's own exercises first, then the catalog. */
export async function allExercises(wsPath: string): Promise<Exercise[]> {
  return [...(await listCustomExercises(wsPath)), ...catalog()]
}

/** An exercise by id; null when there is none. */
export async function findExercise(wsPath: string, id: string): Promise<Exercise | null> {
  const slug = customSlug(id)
  if (slug) return readCustomExercise(wsPath, slug)
  return catalogExercise(id) ?? null
}

export async function getExercise(wsPath: string, id: string): Promise<Exercise> {
  const found = await findExercise(wsPath, id)
  if (!found) throw notFound(`Unknown exercise "${id}"`)
  return found
}

export type ExerciseQuery = {
  q?: string
  muscle?: string
  equipment?: string
  /** Only exercises needing this equipment (see `ownedEquipment`); null or absent = any. */
  owned?: Set<string> | null
  limit?: number
  offset?: number
}

export type ExerciseSearch = { items: Exercise[]; total: number; muscles: string[]; equipment: string[] }

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const distinct = (list: string[]) => [...new Set(list)].toSorted((a, b) => a.localeCompare(b))

/** Search by words in the name (then muscle, equipment…), best match first; paged. */
export async function searchExercises(wsPath: string, query: ExerciseQuery = {}): Promise<ExerciseSearch> {
  const all = await allExercises(wsPath)
  const q = words(query.q ?? '')
  const { muscle, equipment, owned } = query
  const hits = all
    .filter(
      (e) =>
        (muscle === undefined || same(e.muscleGroup, muscle)) &&
        (equipment === undefined || same(e.equipment, equipment)) &&
        (!owned || owned.has(e.equipment)),
    )
    .map((e, i) => ({ e, i, s: score(e, q) }))
    .filter((h) => h.s > 0)
  const ranked = q.length > 0 ? hits.toSorted((a, b) => b.s - a.s || a.i - b.i) : hits
  const offset = Math.max(0, query.offset ?? 0)
  const limit = Math.min(Math.max(query.limit ?? 30, 1), 200)
  return {
    items: ranked.slice(offset, offset + limit).map((h) => h.e),
    total: ranked.length,
    muscles: distinct(all.map((e) => e.muscleGroup)),
    equipment: distinct(all.map((e) => e.equipment)),
  }
}

/** The exercises whose names are closest to `name`: what to offer when an id is unknown. */
export async function closestExercises(wsPath: string, name: string, n = 3): Promise<Exercise[]> {
  const q = words(name)
  if (q.length === 0) return []
  const scored = (await allExercises(wsPath)).map((e) => {
    const own = words(e.name)
    const shared = q.filter((w) => own.includes(w)).length
    return { e, s: shared * 10 - Math.abs(own.length - q.length) }
  })
  return scored
    .filter((x) => x.s > 0)
    .toSorted((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.e)
}

/** Rejects (400) exercise ids that are neither in the catalog nor custom, naming the closest matches. */
export async function assertKnownExercises(
  wsPath: string,
  entries: ReadonlyArray<{ exercise: string; name: string }>,
): Promise<void> {
  const problems: string[] = []
  for (const entry of entries) {
    if (await findExercise(wsPath, entry.exercise)) continue
    const close = await closestExercises(wsPath, entry.name)
    problems.push(
      `unknown exercise id "${entry.exercise}" (${entry.name})${
        close.length > 0 ? `; closest: ${close.map((e) => `${e.id} ${e.name}`).join(', ')}` : ''
      }`,
    )
  }
  if (problems.length > 0) throw badRequest(`${problems.join('. ')}. Use search_exercises to find ids.`)
}
