import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { JournalEntry } from '@/types/journal'
import { generateId } from '@/lib/utils'
import { format } from 'date-fns'

const createDefaultContent = (dateStr: string): string =>
  `## ${dateStr}\n\n### Focus for today\n\n\n\n### Notes\n\n\n\n### EOD Reflection\n\n- What did I complete?\n- What's blocked?\n- What carries over to tomorrow?\n`

// ---------------------------------------------------------------------------
// Tiptap JSON → Markdown converter (used for persist migration)
// ---------------------------------------------------------------------------

interface TiptapMark {
  type: string
  attrs?: Record<string, unknown>
}

interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  text?: string
  marks?: TiptapMark[]
}

function tiptapInlineToMarkdown(node: TiptapNode): string {
  if (node.type === 'hardBreak') return '\n'
  if (node.type !== 'text' || !node.text) return ''

  let text = node.text
  if (node.marks) {
    for (const mark of node.marks) {
      switch (mark.type) {
        case 'bold':
          text = `**${text}**`
          break
        case 'italic':
          text = `*${text}*`
          break
        case 'strike':
          text = `~~${text}~~`
          break
        case 'code':
          text = `\`${text}\``
          break
      }
    }
  }
  return text
}

function tiptapChildrenToInline(node: TiptapNode): string {
  return (node.content || []).map(tiptapInlineToMarkdown).join('')
}

function tiptapNodeToMarkdown(node: TiptapNode, indent = '', orderedIndex?: number): string {
  if (node.type === 'listItem' && orderedIndex != null) {
    const children = node.content || []
    const lines = children.map((c, i) => {
      const md = tiptapNodeToMarkdown(c, indent + '  ')
      return i === 0 ? md.replace(new RegExp(`^${indent}  `), '') : md
    })
    return `${indent}${orderedIndex}. ${lines.join('\n')}`
  }

  switch (node.type) {
    case 'doc':
      return (node.content || []).map((c) => tiptapNodeToMarkdown(c, indent)).join('\n\n')

    case 'heading': {
      const level = (node.attrs?.level as number) || 1
      const prefix = '#'.repeat(level)
      return `${prefix} ${tiptapChildrenToInline(node)}`
    }

    case 'paragraph':
      return `${indent}${tiptapChildrenToInline(node)}`

    case 'bulletList':
      return (node.content || [])
        .map((item) => tiptapNodeToMarkdown(item, indent))
        .join('\n')

    case 'orderedList':
      return (node.content || [])
        .map((item, i) => tiptapNodeToMarkdown(item, indent, i + 1))
        .join('\n')

    case 'listItem': {
      const children = node.content || []
      const lines = children.map((c, i) => {
        const md = tiptapNodeToMarkdown(c, indent + '  ')
        return i === 0 ? md.replace(new RegExp(`^${indent}  `), '') : md
      })
      return `${indent}- ${lines.join('\n')}`
    }

    case 'taskList':
      return (node.content || [])
        .map((item) => tiptapNodeToMarkdown(item, indent))
        .join('\n')

    case 'taskItem': {
      const checked = node.attrs?.checked ? 'x' : ' '
      const children = node.content || []
      const lines = children.map((c, i) => {
        const md = tiptapNodeToMarkdown(c, indent + '  ')
        return i === 0 ? md.replace(new RegExp(`^${indent}  `), '') : md
      })
      return `${indent}- [${checked}] ${lines.join('\n')}`
    }

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) || ''
      const code = tiptapChildrenToInline(node)
      return `\`\`\`${lang}\n${code}\n\`\`\``
    }

    case 'blockquote':
      return (node.content || [])
        .map((c) => `> ${tiptapNodeToMarkdown(c, indent)}`)
        .join('\n')

    case 'horizontalRule':
      return '---'

    case 'hardBreak':
      return '\n'

    case 'text':
      return tiptapInlineToMarkdown(node)

    default:
      return (node.content || []).map((c) => tiptapNodeToMarkdown(c, indent)).join('\n')
  }
}

// Export for potential use in tests
export { tiptapNodeToMarkdown as tiptapJsonToMarkdown }

// ---------------------------------------------------------------------------

interface JournalStore {
  entries: JournalEntry[]
  getEntry: (date: string) => JournalEntry | undefined
  getOrCreateEntry: (date: string) => JournalEntry
  updateEntry: (date: string, content: string) => void
  addLinkedIssue: (date: string, issueKey: string) => void
  getAllDates: () => string[]
}

export const useJournalStore = create<JournalStore>()(
  persist(
    (set, get) => ({
      entries: [],
      getEntry: (date) => get().entries.find((e) => e.date === date),
      getOrCreateEntry: (date) => {
        const existing = get().entries.find((e) => e.date === date)
        if (existing) return existing
        const now = new Date().toISOString()
        const formatted = format(new Date(date), 'EEEE, MMMM d, yyyy')
        const entry: JournalEntry = {
          id: generateId(),
          date,
          content: createDefaultContent(formatted),
          linkedIssues: [],
          completedTodos: [],
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({ entries: [...state.entries, entry] }))
        return entry
      },
      updateEntry: (date, content) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.date === date ? { ...e, content, updatedAt: new Date().toISOString() } : e
          ),
        })),
      addLinkedIssue: (date, issueKey) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.date === date && !e.linkedIssues.includes(issueKey)
              ? { ...e, linkedIssues: [...e.linkedIssues, issueKey] }
              : e
          ),
        })),
      getAllDates: () =>
        get()
          .entries.map((e) => e.date)
          .sort()
          .reverse(),
    }),
    {
      name: 'zync-journal',
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = persisted as any
        if (version === 0 || version === undefined) {
          // Migrate Tiptap JSON content → markdown strings
          if (state?.entries) {
            state.entries = state.entries.map((entry: Record<string, unknown>) => {
              if (entry.content && typeof entry.content === 'object') {
                return {
                  ...entry,
                  content: tiptapNodeToMarkdown(entry.content as TiptapNode),
                }
              }
              return entry
            })
          }
        }
        return state as JournalStore
      },
    }
  )
)
