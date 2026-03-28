export interface Habit {
  id: string
  name: string
  icon: string // lucide icon name (e.g. 'Dumbbell', 'Book')
  category?: string
  frequency?: 'daily' | 'weekdays' | 'weekends' | 'custom'
  customDays?: number[] // 0=Sun, 1=Mon, ..., 6=Sat
  targetDays?: number | null // cycle length, null = open-ended
  startDate: string // yyyy-MM-dd, reset on restart
  archived?: boolean
  createdAt: string
  system?: boolean
}

export interface HabitLog {
  habitId: string
  date: string // yyyy-MM-dd
  completed: boolean
}

export interface Journey {
  name: string
  startDate: string // yyyy-MM-dd
  targetDays: number | null // null = open-ended
  active: boolean
}
