import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OpenCodeSession, OpenCodeConnectionStatus, OpenCodePart, StreamingMessage } from '@/types/opencode'

interface OpenCodeState {
  serverUrl: string
  connectionStatus: OpenCodeConnectionStatus
  activeSessionId: string | null
  sessions: OpenCodeSession[]
  sidebarOpen: boolean
  streamingMessage: StreamingMessage | null
  isStreaming: boolean

  setServerUrl: (url: string) => void
  setConnectionStatus: (status: OpenCodeConnectionStatus) => void
  setActiveSessionId: (id: string | null) => void
  setSessions: (sessions: OpenCodeSession[]) => void
  addSession: (session: OpenCodeSession) => void
  removeSession: (id: string) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  startStreaming: (sessionId: string) => void
  appendStreamingText: (partId: string, fullText: string) => void
  appendStreamingDelta: (partId: string, delta: string) => void
  addStreamingToolCall: (part: OpenCodePart) => void
  trackUserMsgId: (msgId: string) => void
  finishStreaming: () => void
}

export const useOpenCodeStore = create<OpenCodeState>()(
  persist(
    (set) => ({
      serverUrl: '/opencode',
      connectionStatus: { connected: false, serverUrl: '/opencode' },
      activeSessionId: null,
      sessions: [],
      sidebarOpen: false,
      streamingMessage: null,
      isStreaming: false,

      setServerUrl: (url) => set({ serverUrl: url }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      setActiveSessionId: (id) => {
        set({ activeSessionId: id })
        fetch('/api/opencode/active-session', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: id }),
        }).catch(() => {})
      },
      setSessions: (sessions) => set({ sessions }),
      addSession: (session) =>
        set((state) => ({ sessions: [session, ...state.sessions] })),
      removeSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
        })),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      startStreaming: (sessionId) =>
        set({
          isStreaming: true,
          streamingMessage: {
            sessionId,
            parts: [],
            userMsgIds: new Set(),
            partLengths: new Map(),
          },
        }),

      appendStreamingText: (partId, fullText) =>
        set((state) => {
          const sm = state.streamingMessage
          if (!sm) return state
          const sent = sm.partLengths.get(partId) || 0
          if (fullText.length <= sent) return state
          const delta = fullText.slice(sent)
          const newLengths = new Map(sm.partLengths)
          newLengths.set(partId, fullText.length)

          // Find existing text part or create new one
          const existingIdx = sm.parts.findIndex(
            (p) => p.type === 'text' && (p as any)._partId === partId
          )
          let newParts: OpenCodePart[]
          if (existingIdx >= 0) {
            newParts = [...sm.parts]
            const existing = newParts[existingIdx] as { type: 'text'; text: string; _partId: string }
            newParts[existingIdx] = { type: 'text', text: existing.text + delta, _partId: partId } as any
          } else {
            newParts = [...sm.parts, { type: 'text', text: delta, _partId: partId } as any]
          }

          return {
            streamingMessage: { ...sm, parts: newParts, partLengths: newLengths },
          }
        }),

      appendStreamingDelta: (partId, delta) =>
        set((state) => {
          const sm = state.streamingMessage
          if (!sm) return state
          const existingIdx = sm.parts.findIndex(
            (p) => p.type === 'text' && (p as any)._partId === partId
          )
          let newParts: OpenCodePart[]
          if (existingIdx >= 0) {
            newParts = [...sm.parts]
            const existing = newParts[existingIdx] as { type: 'text'; text: string; _partId: string }
            newParts[existingIdx] = { type: 'text', text: existing.text + delta, _partId: partId } as any
          } else {
            newParts = [...sm.parts, { type: 'text', text: delta, _partId: partId } as any]
          }
          return { streamingMessage: { ...sm, parts: newParts } }
        }),

      addStreamingToolCall: (part) =>
        set((state) => {
          const sm = state.streamingMessage
          if (!sm) return state
          const existingIdx = sm.parts.findIndex(
            (p) => p.type === 'tool-invocation' && p.toolInvocation.id === (part as any).toolInvocation?.id
          )
          if (existingIdx >= 0) {
            const newParts = [...sm.parts]
            newParts[existingIdx] = part
            return { streamingMessage: { ...sm, parts: newParts } }
          }
          return { streamingMessage: { ...sm, parts: [...sm.parts, part] } }
        }),

      trackUserMsgId: (msgId) =>
        set((state) => {
          const sm = state.streamingMessage
          if (!sm) return state
          const newIds = new Set(sm.userMsgIds)
          newIds.add(msgId)
          return { streamingMessage: { ...sm, userMsgIds: newIds } }
        }),

      finishStreaming: () =>
        set({ streamingMessage: null, isStreaming: false }),
    }),
    {
      name: 'opencode-store',
      version: 1,
      partialize: (state) => ({
        activeSessionId: state.activeSessionId,
      }),
      migrate: () => ({
        activeSessionId: null,
      }),
    }
  )
)
