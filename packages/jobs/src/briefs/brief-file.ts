import { z } from 'zod'

import { parseFrontmatter, stringifyFrontmatter } from '../frontmatter.js'
import { joinTodos, splitTodos } from './todo-list.js'
import { type Brief, type Todo, TodoSchema } from './types.js'

/** Lenient: a page that doesn't parse is a brief without to-dos. */
export function parseBrief(date: string, source: string): Brief {
  let parsed: ReturnType<typeof parseFrontmatter>
  try {
    parsed = parseFrontmatter(source)
  } catch {
    return { date, todos: [], sources: [], body: source.trim(), extra: {} }
  }
  const { todos: legacy, sources, ...extra } = parsed.data
  const { todos, rest } = splitTodos(parsed.content)
  return {
    date,
    // Older briefs kept their to-dos in the frontmatter.
    todos: todos.length || !Array.isArray(legacy) ? todos : legacy.flatMap((t) => validTodo(t)),
    sources: z.array(z.string()).catch([]).parse(sources),
    body: rest,
    extra,
  }
}

function validTodo(value: unknown): Todo[] {
  const r = TodoSchema.safeParse(value)
  return r.success ? [r.data] : []
}

export function serializeBrief(brief: Brief): string {
  const meta: Record<string, unknown> = {}
  if (brief.sources.length) meta.sources = brief.sources
  for (const [k, v] of Object.entries(brief.extra)) if (!(k in meta) && v !== undefined) meta[k] = v
  return stringifyFrontmatter(meta, joinTodos(brief.todos, brief.body))
}
