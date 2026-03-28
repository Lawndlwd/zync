import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LifeOsView = 'game-board' | 'morning' | 'evening' | 'journal' | 'projects'

interface LifeOsState {
  activeView: LifeOsView
  setActiveView: (view: LifeOsView) => void

  // Morning protocol wizard
  morningStep: number
  morningAnswers: Record<string, string>
  setMorningStep: (step: number) => void
  setMorningAnswer: (key: string, answer: string) => void
  resetMorning: () => void

  // Evening synthesis wizard
  eveningStep: number
  eveningAnswers: Record<string, string>
  setEveningStep: (step: number) => void
  setEveningAnswer: (key: string, answer: string) => void
  resetEvening: () => void

  // Editing
  editingComponentId: string | null
  setEditingComponentId: (id: string | null) => void
}

export const useLifeOsStore = create<LifeOsState>()(
  persist(
    (set) => ({
      activeView: 'game-board',
      setActiveView: (view) => set({ activeView: view }),

      morningStep: 0,
      morningAnswers: {},
      setMorningStep: (step) => set({ morningStep: step }),
      setMorningAnswer: (key, answer) =>
        set((state) => ({ morningAnswers: { ...state.morningAnswers, [key]: answer } })),
      resetMorning: () => set({ morningStep: 0, morningAnswers: {} }),

      eveningStep: 0,
      eveningAnswers: {},
      setEveningStep: (step) => set({ eveningStep: step }),
      setEveningAnswer: (key, answer) =>
        set((state) => ({ eveningAnswers: { ...state.eveningAnswers, [key]: answer } })),
      resetEvening: () => set({ eveningStep: 0, eveningAnswers: {} }),

      editingComponentId: null,
      setEditingComponentId: (id) => set({ editingComponentId: id }),
    }),
    { name: 'life-os-state' },
  ),
)
