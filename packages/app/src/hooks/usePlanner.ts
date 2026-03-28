import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPlannerPage,
  createPlannerReminder,
  deletePlannerGoal,
  deletePlannerPage,
  deletePlannerReminder,
  fetchGoals,
  fetchPage,
  fetchReminders,
  updatePlannerGoal,
  updatePlannerPage,
  updatePlannerReminder,
} from '@/services/planner'

export function usePlannerGoals(categoryId?: string) {
  return useQuery({
    queryKey: ['planner', 'goals', categoryId],
    queryFn: () => fetchGoals(categoryId),
  })
}

export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...updates
    }: {
      id: string
      title?: string
      description?: string
      targetDate?: string
      status?: string
      progress?: number
      aiPlan?: any
    }) => updatePlannerGoal(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planner', 'goals'] })
    },
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePlannerGoal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planner', 'goals'] })
    },
  })
}

export function usePlannerReminders(upcoming = false) {
  return useQuery({
    queryKey: ['planner', 'reminders', upcoming],
    queryFn: () => fetchReminders(upcoming),
  })
}

export function useCreateReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPlannerReminder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planner', 'reminders'] })
    },
  })
}

export function useUpdateReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...updates
    }: {
      id: string
      title?: string
      description?: string
      dueAt?: string
      repeat?: string
      completed?: boolean
    }) => updatePlannerReminder(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planner', 'reminders'] })
    },
  })
}

export function useDeleteReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePlannerReminder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planner', 'reminders'] })
    },
  })
}

// --- Pages ---
export function usePlannerPage(id: string | null) {
  return useQuery({
    queryKey: ['planner', 'page', id],
    queryFn: () => fetchPage(id!),
    enabled: !!id,
  })
}

export function useCreatePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPlannerPage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planner', 'pages'] })
    },
  })
}

export function useUpdatePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...updates
    }: {
      id: string
      title?: string
      content?: string
      icon?: string
      pinned?: boolean
      parentId?: string | null
      order?: number
    }) => updatePlannerPage(id, updates),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['planner', 'pages'] })
      qc.invalidateQueries({ queryKey: ['planner', 'page', variables.id] })
    },
  })
}

export function useDeletePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePlannerPage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planner', 'pages'] })
    },
  })
}
