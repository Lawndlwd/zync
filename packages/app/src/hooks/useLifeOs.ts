import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAutopilotBreaker,
  createDailyLever,
  createLifeOsComponent,
  deleteAutopilotBreaker,
  deleteDailyLever,
  deleteLifeOsComponent,
  fetchAutopilotBreakers,
  fetchDailyLevers,
  fetchIdentity,
  fetchJournalEntries,
  fetchJournalEntry,
  fetchJournalStreak,
  fetchLifeOsComponent,
  fetchLifeOsComponents,
  fetchLifeOsStats,
  fetchPsyScores,
  fetchPsyScoreToday,
  fetchXpEvents,
  saveJournalEntry,
  toggleDailyLever,
  updateAutopilotBreaker,
  updateLifeOsComponent,
  upsertIdentity,
  upsertPsyScore,
} from '@/services/life-os'

// --- Components ---
export function useLifeOsComponents() {
  return useQuery({
    queryKey: ['life-os', 'components'],
    queryFn: fetchLifeOsComponents,
    staleTime: 30_000,
  })
}

export function useLifeOsComponent(type: string) {
  return useQuery({
    queryKey: ['life-os', 'components', type],
    queryFn: () => fetchLifeOsComponent(type),
    staleTime: 30_000,
  })
}

export function useCreateLifeOsComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createLifeOsComponent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'components'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'goals'] })
    },
  })
}

export function useUpdateLifeOsComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => updateLifeOsComponent(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'components'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'goals'] })
    },
  })
}

export function useDeleteLifeOsComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteLifeOsComponent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'components'] })
    },
  })
}

// --- Identity ---
export function useIdentity() {
  return useQuery({
    queryKey: ['life-os', 'identity'],
    queryFn: fetchIdentity,
    staleTime: 60_000,
  })
}

export function useUpdateIdentity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: upsertIdentity,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'identity'] })
    },
  })
}

// --- Daily Levers ---
export function useDailyLevers(date?: string) {
  return useQuery({
    queryKey: ['life-os', 'levers', date],
    queryFn: () => fetchDailyLevers(date),
    staleTime: 10_000,
  })
}

export function useCreateDailyLever() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createDailyLever,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'levers'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'stats'] })
    },
  })
}

export function useToggleDailyLever() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: toggleDailyLever,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'levers'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'stats'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'xp'] })
    },
  })
}

export function useDeleteDailyLever() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteDailyLever,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'levers'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'stats'] })
    },
  })
}

// --- Autopilot Breakers ---
export function useAutopilotBreakers() {
  return useQuery({
    queryKey: ['life-os', 'breakers'],
    queryFn: fetchAutopilotBreakers,
    staleTime: 60_000,
  })
}

export function useCreateAutopilotBreaker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createAutopilotBreaker,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'breakers'] })
    },
  })
}

export function useUpdateAutopilotBreaker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => updateAutopilotBreaker(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'breakers'] })
    },
  })
}

export function useDeleteAutopilotBreaker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteAutopilotBreaker,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'breakers'] })
    },
  })
}

// --- Journal ---
export function useJournalEntry(date: string, type: string) {
  return useQuery({
    queryKey: ['life-os', 'journal', date, type],
    queryFn: () => fetchJournalEntry(date, type),
    staleTime: 30_000,
  })
}

export function useJournalEntries(opts?: { from?: string; to?: string; type?: string }) {
  return useQuery({
    queryKey: ['life-os', 'journal', 'list', opts],
    queryFn: () => fetchJournalEntries(opts),
    staleTime: 30_000,
  })
}

export function useSaveJournal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveJournalEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'journal'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'stats'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'xp'] })
    },
  })
}

// --- XP ---
export function useXpEvents(opts?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['life-os', 'xp', opts],
    queryFn: () => fetchXpEvents(opts),
    staleTime: 30_000,
  })
}

// --- Stats ---
export function useLifeOsStats() {
  return useQuery({
    queryKey: ['life-os', 'stats'],
    queryFn: fetchLifeOsStats,
    staleTime: 10_000,
    refetchInterval: 30_000,
  })
}

// --- Psy Tracker ---
export function usePsyScores(days = 30) {
  return useQuery({ queryKey: ['psy-scores', days], queryFn: () => fetchPsyScores(days), staleTime: 30_000 })
}

export function usePsyScoreToday() {
  return useQuery({ queryKey: ['psy-score-today'], queryFn: fetchPsyScoreToday, staleTime: 10_000 })
}

export function useUpsertPsyScore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, score, note }: { date: string; score: number; note?: string }) =>
      upsertPsyScore(date, score, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['psy-score'] })
      qc.invalidateQueries({ queryKey: ['psy-scores'] })
    },
  })
}

// --- Journal Streak ---
export function useJournalStreak() {
  return useQuery({ queryKey: ['journal-streak'], queryFn: fetchJournalStreak, staleTime: 30_000 })
}
