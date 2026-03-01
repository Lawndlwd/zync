import { create } from 'zustand'
import type { OpenCodeSession, OpenCodeConnectionStatus } from '@/types/opencode'

interface OpenCodeState {
  serverUrl: string
  connectionStatus: OpenCodeConnectionStatus
  activeSessionId: string | null
  sessions: OpenCodeSession[]
  sidebarOpen: boolean

  setServerUrl: (url: string) => void
  setConnectionStatus: (status: OpenCodeConnectionStatus) => void
  setActiveSessionId: (id: string | null) => void
  setSessions: (sessions: OpenCodeSession[]) => void
  addSession: (session: OpenCodeSession) => void
  removeSession: (id: string) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useOpenCodeStore = create<OpenCodeState>()((set) => ({
  serverUrl: 'http://localhost:4096',
  connectionStatus: { connected: false, serverUrl: 'http://localhost:4096' },
  activeSessionId: null,
  sessions: [],
  sidebarOpen: false,

  setServerUrl: (url) => set({ serverUrl: url }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
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
}))
