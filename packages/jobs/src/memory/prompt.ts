import path from 'node:path'

import { collectMemory, type MemoryContext } from './context.js'
import type { Memory } from './types.js'

/** Characters, not tokens (~4 per token). Keeps the prompt small even with a big memory. */
export const PROMPT_BUDGET = { person: 2500, pinned: 2500, total: 16000 }

const clip = (text: string, max: number, hint: string) =>
  text.length <= max ? text : `${text.slice(0, max).trimEnd()}\n… (truncated: ${hint})`

const label = (m: Memory) => `${m.scope}${m.type ? ` · ${m.type}` : ''}`

/**
 * The memory block added to the system prompt: instructions, people notes, pinned memories in full
 * and an index of the rest. Rebuilt on every request, so edits apply to the next message.
 */
export async function buildMemoryPrompt(ctx: MemoryContext = {}): Promise<string> {
  const { notes, memories } = await collectMemory(ctx)
  const wsName = ctx.wsPath ? path.basename(ctx.wsPath) : undefined
  const out: string[] = [
    '<memory>',
    'You have a persistent memory shared by every chat and scheduled job in this app. The user reads and edits it on the Memory and People pages, so keep it clean and factual.',
    '',
    '- Apply what is below without being asked; rules and preferences are standing instructions from the user.',
    '- Save as you go with memory_save when you learn something durable: a preference or correction ("don\'t…", "always…", "from now on…"), how the user usually does a task, a recurring routine, a decision or fact about a project. Do not ask first; say it in one short line ("Saved to memory: …").',
    '- What you learn about a person (the user is @me) goes in their note with person_note, not in a memory.',
    '- One topic per memory. Update the existing memory (same title) instead of adding a near-duplicate; delete memories that turn out wrong.',
    '- Never save secrets, passwords or one-off task details, or what is already written in the workspace files.',
    wsName
      ? `- scope "workspace" = only the "${wsName}" workspace; scope "global" = everywhere.`
      : '- There is no current workspace: save with scope "global".',
  ]

  let used = 0
  const push = (s: string) => {
    out.push(s)
    used += s.length
  }

  const me = notes.find((n) => n.person.id === 'me')
  const ai = notes.find((n) => n.person.id === 'ai')
  if (me?.notes)
    push(
      `\n## About the user (@me, ${me.person.name})\n${clip(me.notes, PROMPT_BUDGET.person * 2, 'person_read "me"')}`,
    )
  if (ai?.notes)
    push(`\n## How the user wants you to work (@ai)\n${clip(ai.notes, PROMPT_BUDGET.person * 2, 'person_read "ai"')}`)

  const others = notes.filter((n) => !n.person.builtin)
  if (others.length) {
    push('\n## People')
    for (const { person, notes: text } of others) {
      const head = `### ${person.name} (@${person.id})`
      if (!text) push(`${head}\n(no notes yet)`)
      else if (used > PROMPT_BUDGET.total) push(`${head}\n(note not shown: person_read "${person.id}")`)
      else push(`${head}\n${clip(text, PROMPT_BUDGET.person, `person_read "${person.id}"`)}`)
    }
  }

  const pinned = memories.filter((m) => m.pinned)
  const rest = memories.filter((m) => !m.pinned)
  const shown: Memory[] = []
  if (pinned.length) {
    push('\n## Pinned memories')
    for (const m of pinned) {
      if (used > PROMPT_BUDGET.total) {
        rest.unshift(m)
        continue
      }
      shown.push(m)
      push(
        `### ${m.title} [${label(m)}]\n${clip(m.body || m.description || '', PROMPT_BUDGET.pinned, `memory_read "${m.title}"`)}`,
      )
    }
  }
  if (rest.length) {
    push('\n## Other memories (open with memory_read when relevant)')
    for (const m of rest) push(`- ${m.title} [${label(m)}]${m.description ? ` — ${m.description}` : ''}`)
  }
  if (!notes.some((n) => n.notes) && !memories.length)
    push('\n(Memory is empty so far. Start saving what you learn about the user and how they work.)')

  out.push('</memory>')
  return out.join('\n')
}
