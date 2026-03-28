import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PlannerPreferences {
  activeCategory: string
  spacesExpanded: boolean
  taskViewMode: 'list' | 'priority'
  setActiveCategory: (slug: string) => void
  setSpacesExpanded: (expanded: boolean) => void
  setTaskViewMode: (mode: 'list' | 'priority') => void
}

export const usePlannerStore = create<PlannerPreferences>()(
  persist(
    (set) => ({
      activeCategory: 'planning',
      spacesExpanded: true,
      taskViewMode: 'list',
      setActiveCategory: (slug) => set({ activeCategory: slug }),
      setSpacesExpanded: (expanded) => set({ spacesExpanded: expanded }),
      setTaskViewMode: (mode) => set({ taskViewMode: mode }),
    }),
    { name: 'planner-preferences' },
  ),
)
