import type { Todo } from './types.js'

// A brief's to-dos are a checklist at the top of its page, so they read and tick like any page:
//
//   ## To-do
//   - [ ] Reply to Sara about the offer — Gmail · work · [open](https://mail.google.com/…)
//   - [x] Prepare the design review — Calendar · [card](<Launch/Prepare the design review.md>)
//
// One line per to-do: the box, the title, " — " and where it came from, then links: [open] back to
// the message or event, [card] to the card it became.

export const TODO_HEADING = '## To-do'

const HEADING = /^#{1,2}\s+to-?dos?\s*$/i
const SECTION_END = /^#{1,2}\s/
const TASK = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/
const LINK = /\[([^\]]*)\]\((<[^>]*>|[^)\s]*)\)/g

/** A link target as written: <angle brackets> allow spaces, %20 is decoded. */
function target(raw: string): string {
  const t = raw.startsWith('<') && raw.endsWith('>') ? raw.slice(1, -1) : raw
  try {
    return decodeURI(t)
  } catch {
    return t
  }
}

export function parseTodoLine(line: string): Todo | null {
  const m = TASK.exec(line)
  if (!m?.[2]) return null
  let link: string | undefined
  let card: string | undefined
  for (const [, label, raw] of m[2].matchAll(LINK)) {
    const to = target(raw ?? '')
    const web = /^https?:/i.test(to)
    if (label === 'card' || (!web && to.endsWith('.md'))) card ??= to
    else if (web) link ??= to
  }
  const text = m[2]
    .replaceAll(LINK, '')
    .replace(/(\s*·\s*)+$/, '')
    .trim()
  const dash = text.lastIndexOf(' — ')
  const title = (dash > 0 ? text.slice(0, dash) : text).trim()
  if (!title) return null
  const source = dash > 0 ? text.slice(dash + 3).trim() : ''
  return {
    title,
    done: m[1] !== ' ',
    ...(source ? { source } : {}),
    ...(link ? { link } : {}),
    ...(card ? { card } : {}),
  }
}

/** Links with spaces go in <angle brackets>, as markdown allows. */
const linkTo = (to: string) => (/[\s()<>]/.test(to) ? `<${to}>` : to)

export function formatTodo(t: Todo): string {
  const parts = [`- [${t.done ? 'x' : ' '}] ${t.title}${t.source ? ` — ${t.source}` : ''}`]
  if (t.link) parts.push(`[open](${linkTo(t.link)})`)
  if (t.card) parts.push(`[card](${linkTo(t.card)})`)
  return parts.join(' · ')
}

/** The page split in two: its to-do checklist, and everything else. */
export function splitTodos(body: string): { todos: Todo[]; rest: string } {
  const lines = body.split('\n')
  const start = lines.findIndex((l) => HEADING.test(l.trim()))
  if (start === -1) return { todos: [], rest: body.trim() }
  const after = lines.slice(start + 1)
  const len = after.findIndex((l) => SECTION_END.test(l.trim()))
  const section = len === -1 ? after : after.slice(0, len)
  const todos = section.flatMap((l) => {
    const t = parseTodoLine(l)
    return t ? [t] : []
  })
  const rest = [...lines.slice(0, start), ...(len === -1 ? [] : after.slice(len))].join('\n').trim()
  return { todos, rest }
}

/** The page from its to-dos (first) and the rest. */
export function joinTodos(todos: Todo[], rest: string): string {
  const list = todos.length ? `${TODO_HEADING}\n${todos.map(formatTodo).join('\n')}` : ''
  return [list, rest.trim()].filter(Boolean).join('\n\n')
}
