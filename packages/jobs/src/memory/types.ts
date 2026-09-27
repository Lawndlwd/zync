import { z } from 'zod'

// The AI's memory is plain markdown, like everything else in zync:
//
//   <root>/.zync/memory/<title>.md        remembered everywhere (global)
//   <ws>/.zync/memory/<title>.md          remembered in one workspace
//   <root>/.zync/people/<id>.md           what the AI knows about a person (@me = the user, @ai = itself)
//
// A memory's file name is its title; the frontmatter holds `type`, `description` (the one line shown
// in the index) and `pinned` (full text always in the prompt). The opencode plugin (opencode-plugin.ts)
// puts the people notes, the pinned memories and an index of the rest into every chat's system prompt,
// and gives the AI tools to read and write them. The Memory and People pages edit the same files.

export const MEMORY_TYPES = ['rule', 'preference', 'habit', 'fact'] as const
export type MemoryType = (typeof MEMORY_TYPES)[number]
export type MemoryScope = 'global' | 'workspace'

export type Memory = {
  /** File name inside the memory folder; the title is the name without `.md`. */
  file: string
  title: string
  scope: MemoryScope
  type?: MemoryType
  /** One line: what this memory is about. Shown in the index the AI always sees. */
  description?: string
  /** Always put the full text in the prompt (otherwise only the title and description are). */
  pinned: boolean
  /** Last write, ISO date-time (the file's mtime). */
  updated: string
  body: string
  /** Frontmatter keys we don't manage, preserved on write. */
  extra: Record<string, unknown>
}

export type MemoryPatch = {
  title?: string
  type?: MemoryType | null
  description?: string | null
  pinned?: boolean
  body?: string
}

export const TypeSchema = z.enum(MEMORY_TYPES)
