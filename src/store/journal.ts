import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { JournalEntry } from '@/types/journal'
import { generateId } from '@/lib/utils'
import { format } from 'date-fns'
import type { JSONContent } from '@tiptap/react'

const createDefaultContent = (dateStr: string): JSONContent => ({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: dateStr }] },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Focus for today' }] },
    { type: 'paragraph', content: [{ type: 'text', text: '' }] },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Notes' }] },
    { type: 'paragraph', content: [{ type: 'text', text: '' }] },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'EOD Reflection' }] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'What did I complete?' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: "What's blocked?" }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'What carries over to tomorrow?' }] }] },
    ]},
  ],
})

interface JournalStore {
  entries: JournalEntry[]
  getEntry: (date: string) => JournalEntry | undefined
  getOrCreateEntry: (date: string) => JournalEntry
  updateEntry: (date: string, content: JSONContent) => void
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
    { name: 'ai-dashboard-journal' }
  )
)
