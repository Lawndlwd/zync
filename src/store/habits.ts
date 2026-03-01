import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Habit, HabitLog, Journey } from '@/types/habit'
import { format, differenceInCalendarDays, subDays } from 'date-fns'

interface CycleProgress {
  dayNumber: number
  targetDays: number
  isComplete: boolean
}

interface HabitsState {
  habits: Habit[]
  logs: HabitLog[]
  journey: Journey | null

  addHabit: (params: {
    name: string
    icon: string
    category?: string
    frequency?: Habit['frequency']
    customDays?: number[]
    targetDays?: number | null
  }) => void
  removeHabit: (id: string) => void
  archiveHabit: (id: string) => void
  restartHabit: (id: string) => void
  toggleHabitForDate: (habitId: string, date: string) => void
  setJourney: (journey: Journey) => void
  clearJourney: () => void

  getStreak: (habitId: string) => number
  getBestStreak: (habitId: string) => number
  getCompletionRate: (habitId: string, days: number) => number
  getWeeklyScore: () => number
  getCompletionsPerDay: (days: number) => { date: string; count: number; total: number }[]
  getHeatmapData: (weeks: number) => { date: string; intensity: number }[]
  getAtRiskHabits: () => Habit[]
  getMissedToday: () => Habit[]
  getCompletionsForDate: (date: string) => HabitLog[]
  getDayNumber: (date: string) => number | null
  getCycleProgress: (id: string) => CycleProgress | null
  isHabitDueToday: (id: string) => boolean
  getActiveHabits: () => Habit[]
  getArchivedHabits: () => Habit[]
}

function isDueOnDay(habit: Habit, dayOfWeek: number): boolean {
  if (habit.frequency === 'daily') return true
  if (habit.frequency === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5
  if (habit.frequency === 'weekends') return dayOfWeek === 0 || dayOfWeek === 6
  if (habit.frequency === 'custom' && habit.customDays) return habit.customDays.includes(dayOfWeek)
  return true
}

export const useHabitsStore = create<HabitsState>()(
  persist(
    (set, get) => ({
      habits: [],
      logs: [],
      journey: null,

      addHabit: ({ name, icon, category, frequency, customDays, targetDays }) => {
        const habit: Habit = {
          id: crypto.randomUUID(),
          name,
          icon,
          category,
          frequency: frequency || 'daily',
          customDays,
          targetDays: targetDays ?? null,
          startDate: format(new Date(), 'yyyy-MM-dd'),
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ habits: [...s.habits, habit] }))
      },

      removeHabit: (id) => {
        set((s) => ({
          habits: s.habits.filter((h) => h.id !== id),
          logs: s.logs.filter((l) => l.habitId !== id),
        }))
      },

      archiveHabit: (id) => {
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, archived: true } : h)),
        }))
      },

      restartHabit: (id) => {
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === id
              ? { ...h, archived: false, startDate: format(new Date(), 'yyyy-MM-dd') }
              : h
          ),
        }))
      },

      toggleHabitForDate: (habitId, date) => {
        set((s) => {
          const existing = s.logs.find((l) => l.habitId === habitId && l.date === date)
          if (existing) {
            return { logs: s.logs.filter((l) => !(l.habitId === habitId && l.date === date)) }
          }
          return { logs: [...s.logs, { habitId, date, completed: true }] }
        })
      },

      setJourney: (journey) => set({ journey }),
      clearJourney: () => set({ journey: null }),

      getActiveHabits: () => get().habits.filter((h) => !h.archived),
      getArchivedHabits: () => get().habits.filter((h) => h.archived),

      getCycleProgress: (id) => {
        const habit = get().habits.find((h) => h.id === id)
        if (!habit || !habit.targetDays) return null
        const dayNumber = differenceInCalendarDays(new Date(), new Date(habit.startDate)) + 1
        return {
          dayNumber,
          targetDays: habit.targetDays,
          isComplete: dayNumber > habit.targetDays,
        }
      },

      isHabitDueToday: (id) => {
        const habit = get().habits.find((h) => h.id === id)
        if (!habit || habit.archived) return false
        return isDueOnDay(habit, new Date().getDay())
      },

      getStreak: (habitId) => {
        const { logs } = get()
        let streak = 0

        for (let i = 0; i < 365; i++) {
          const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
          if (logs.some((l) => l.habitId === habitId && l.date === d)) {
            streak++
          } else {
            if (i === 0) continue
            break
          }
        }

        return streak
      },

      getBestStreak: (habitId) => {
        const { logs } = get()
        const habitLogs = logs
          .filter((l) => l.habitId === habitId)
          .map((l) => l.date)
          .sort()

        if (habitLogs.length === 0) return 0

        let best = 1
        let current = 1

        for (let i = 1; i < habitLogs.length; i++) {
          const diff = differenceInCalendarDays(new Date(habitLogs[i]), new Date(habitLogs[i - 1]))
          if (diff === 1) {
            current++
            if (current > best) best = current
          } else if (diff > 1) {
            current = 1
          }
        }

        return best
      },

      getCompletionRate: (habitId, days) => {
        const { logs } = get()
        let completed = 0
        for (let i = 0; i < days; i++) {
          const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
          if (logs.some((l) => l.habitId === habitId && l.date === d)) {
            completed++
          }
        }
        return days > 0 ? Math.round((completed / days) * 100) : 0
      },

      getWeeklyScore: () => {
        const { logs } = get()
        const active = get().getActiveHabits()
        if (active.length === 0) return 0
        let completed = 0
        for (let i = 0; i < 7; i++) {
          const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
          completed += logs.filter((l) => l.date === d && active.some((h) => h.id === l.habitId)).length
        }
        const total = active.length * 7
        return Math.round((completed / total) * 100)
      },

      getCompletionsPerDay: (days) => {
        const { logs } = get()
        const active = get().getActiveHabits()
        const result: { date: string; count: number; total: number }[] = []
        for (let i = days - 1; i >= 0; i--) {
          const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
          const count = logs.filter((l) => l.date === d && active.some((h) => h.id === l.habitId)).length
          result.push({ date: d, count, total: active.length })
        }
        return result
      },

      getHeatmapData: (weeks) => {
        const { logs } = get()
        const active = get().getActiveHabits()
        const days = weeks * 7
        const result: { date: string; intensity: number }[] = []
        for (let i = days - 1; i >= 0; i--) {
          const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
          const count = logs.filter((l) => l.date === d && active.some((h) => h.id === l.habitId)).length
          const total = active.length
          const pct = total > 0 ? count / total : 0
          let intensity = 0
          if (pct > 0) intensity = 1
          if (pct >= 0.25) intensity = 2
          if (pct >= 0.5) intensity = 3
          if (pct >= 0.75) intensity = 4
          if (pct >= 1) intensity = 5
          result.push({ date: d, intensity })
        }
        return result
      },

      getAtRiskHabits: () => {
        const { logs } = get()
        const active = get().getActiveHabits()
        const today = format(new Date(), 'yyyy-MM-dd')
        const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

        return active.filter((h) => {
          if (!isDueOnDay(h, new Date().getDay())) return false
          const doneToday = logs.some((l) => l.habitId === h.id && l.date === today)
          const doneYesterday = logs.some((l) => l.habitId === h.id && l.date === yesterday)
          return !doneToday && doneYesterday
        })
      },

      getMissedToday: () => {
        const { logs } = get()
        const active = get().getActiveHabits()
        const today = format(new Date(), 'yyyy-MM-dd')
        return active.filter((h) => {
          if (!isDueOnDay(h, new Date().getDay())) return false
          return !logs.some((l) => l.habitId === h.id && l.date === today)
        })
      },

      getCompletionsForDate: (date) => {
        return get().logs.filter((l) => l.date === date)
      },

      getDayNumber: (date) => {
        const { journey } = get()
        if (!journey || !journey.active) return null
        const diff = differenceInCalendarDays(new Date(date), new Date(journey.startDate))
        if (diff < 0) return null
        return diff + 1
      },
    }),
    { name: 'ai-dashboard-habits' }
  )
)
