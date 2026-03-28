import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createGoal,
  createGoalTask,
  deleteGoal,
  deleteGoalTask,
  fetchGoal,
  fetchGoalChildren,
  fetchGoalRoots,
  fetchGoalTasks,
  scaffoldGoalChildren,
  toggleGoalTask,
  updateGoal,
} from '@/services/goals'

export function useGoalRoots(status?: string) {
  return useQuery({
    queryKey: ['life-os', 'goals', 'roots', status],
    queryFn: () => fetchGoalRoots(status),
    staleTime: 30_000,
  })
}

export function useGoal(id: string | null) {
  return useQuery({
    queryKey: ['life-os', 'goal', id],
    queryFn: () => fetchGoal(id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useGoalChildren(parentId: string | null) {
  return useQuery({
    queryKey: ['life-os', 'goals', 'children', parentId],
    queryFn: () => fetchGoalChildren(parentId!),
    enabled: !!parentId,
    staleTime: 30_000,
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createGoal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'goals'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'components'] })
    },
  })
}

export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => updateGoal(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'goals'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'goal'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'components'] })
    },
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'goals'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'goal'] })
    },
  })
}

export function useScaffoldGoalChildren() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: scaffoldGoalChildren,
    onSuccess: (_data, goalId) => {
      qc.invalidateQueries({ queryKey: ['life-os', 'goals', 'children', goalId] })
    },
  })
}

export function useGoalTasks(goalId: string | null) {
  return useQuery({
    queryKey: ['life-os', 'goal-tasks', goalId],
    queryFn: () => fetchGoalTasks(goalId!),
    enabled: !!goalId,
    staleTime: 10_000,
  })
}

export function useCreateGoalTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ goalId, title }: { goalId: string; title: string }) => createGoalTask(goalId, title),
    onSuccess: (_data, { goalId }) => {
      qc.invalidateQueries({ queryKey: ['life-os', 'goal-tasks', goalId] })
      qc.invalidateQueries({ queryKey: ['life-os', 'goal'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'goals'] })
    },
  })
}

export function useToggleGoalTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: toggleGoalTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'goal-tasks'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'goal'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'goals'] })
    },
  })
}

export function useDeleteGoalTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteGoalTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['life-os', 'goal-tasks'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'goal'] })
      qc.invalidateQueries({ queryKey: ['life-os', 'goals'] })
    },
  })
}
