import { create } from 'zustand'
import type { ChatMessage } from '@zync/shared/types'
import { generateId } from '@/lib/utils'

interface ChatStore {
  messages: ChatMessage[]
  isOpen: boolean
  isLoading: boolean
  addMessage: (role: ChatMessage['role'], content: string) => ChatMessage
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  appendToMessage: (id: string, chunk: string) => void
  setLoading: (loading: boolean) => void
  toggleChat: () => void
  openChat: () => void
  closeChat: () => void
  clearMessages: () => void
}

export const useChatStore = create<ChatStore>()((set) => ({
  messages: [],
  isOpen: false,
  isLoading: false,
  addMessage: (role, content) => {
    const msg: ChatMessage = {
      id: generateId(),
      role,
      content,
      timestamp: new Date().toISOString(),
    }
    set((state) => ({ messages: [...state.messages, msg] }))
    return msg
  },
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  appendToMessage: (id, chunk) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + chunk } : m
      ),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),
  clearMessages: () => set({ messages: [] }),
}))
