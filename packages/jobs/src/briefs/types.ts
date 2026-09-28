import { z } from 'zod'

import { dayField } from '../helpers/dates.js'

// A daily brief is a markdown page in the workspace's `Briefs/` folder, one per day, written by the
// daily-brief job (the AI, through the `write_brief` tool). The file name is the date; the page
// starts with the suggested to-dos as a checklist (see todo-list.ts), then the brief itself.
//
//   <ws>/Briefs/2026-09-28.md
//   ---
//   sources: [Gmail · work, Gmail · perso, Slack · acme, Telegram, Calendar, Boards]
//   ---
//   ## To-do
//   - [ ] Answer Sara about the offer — Gmail · work · [open](https://mail.google.com/…)
//   - [x] Prepare the 14:00 design review — Calendar · [card](<Launch/Prepare the design review.md>)
//
//   ## Meetings
//   …
//
// Briefs written before kept their to-dos in the frontmatter (`todos:`); they are still read, and
// move into the page the next time they are written.

export const BRIEFS_DIR = 'Briefs'

export const TodoSchema = z.object({
  title: z.string().trim().min(1).max(200),
  /** Where it came from, e.g. "Gmail · work", "Slack · #design", "Calendar". */
  source: z.string().trim().max(120).optional(),
  /** Back to the message or event (a web link, or a workspace-relative file). */
  link: z.string().trim().max(2000).optional(),
  /** Workspace-relative card file, once the to-do was turned into a card. */
  card: z.string().max(1000).optional(),
  /** Ticked in the checklist. */
  done: z.boolean().default(false),
})
export type Todo = z.infer<typeof TodoSchema>
/** A to-do as the AI suggests it: no card yet, not done. */
export const TodoInputSchema = TodoSchema.omit({ card: true, done: true })

export const BriefDate = dayField('must look like 2026-09-28')

export type Brief = {
  /** "YYYY-MM-DD", also the file name. */
  date: string
  todos: Todo[]
  /** What was checked to write it. */
  sources: string[]
  /** The page without its to-do checklist. */
  body: string
  /** Frontmatter keys we don't manage, preserved on write. */
  extra: Record<string, unknown>
}

/** What the calendar needs per day: that there is a brief, and how many to-dos are still open. */
export type BriefSummary = { date: string; todos: number; open: number }

/** What the AI writes; cards and ticks are kept from the previous version of the same day. */
export type BriefInput = { body: string; todos: Array<z.input<typeof TodoInputSchema>>; sources?: string[] }
