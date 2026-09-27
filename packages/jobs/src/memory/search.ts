import { collectMemory, type MemoryContext } from './context.js'
import type { MemoryScope } from './types.js'

export type MemoryHit = {
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
  const { notes, memories } = await collectMemory(ctx)
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
  return hits.toSorted((a, b) => b.score - a.score).slice(0, 10)
}
