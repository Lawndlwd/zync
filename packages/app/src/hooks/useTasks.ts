import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Task, TaskStatus } from '@zync/shared/types'
import {
  fetchAllTasks,
  fetchProjectTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
} from '@/services/projects'

// Helper: patch a single task in a cached task list
function patchTaskInList(old: Task[] | undefined, updated: Task): Task[] | undefined {
  return old?.map((t) =>
    t.fileName === updated.fileName && t.project === updated.project ? updated : t
  )
}

export function useAllTasks() {
  return useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: fetchAllTasks,
    refetchOnWindowFocus: false,
  })
}

export function useProjectTasks(projectName: string) {
  return useQuery({
    queryKey: ['tasks', projectName],
    queryFn: () => fetchProjectTasks(projectName),
    enabled: !!projectName,
    refetchOnWindowFocus: false,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectName, ...input }: { projectName: string; title: string; assignee?: string; priority?: string; tags?: string[]; content?: string }) =>
      createTask(projectName, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectName, taskFile, ...updates }: { projectName: string; taskFile: string; title?: string; status?: string; assignee?: string; priority?: string; tags?: string[]; content?: string }) =>
      updateTask(projectName, taskFile, updates),
    onSuccess: (updatedTask) => {
      // Patch the task directly in cache — no refetch, no board flicker
      qc.setQueryData<Task[]>(['tasks', 'all'], (old) => patchTaskInList(old, updatedTask))
      qc.setQueryData<Task[]>(['tasks', updatedTask.project], (old) => patchTaskInList(old, updatedTask))
    },
  })
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectName, taskFile, status }: { projectName: string; taskFile: string; status: TaskStatus }) =>
      updateTaskStatus(projectName, taskFile, status),
    onMutate: ({ projectName, taskFile, status }) => {
      // Cancel without awaiting — abort signal fires synchronously,
      // keeps onMutate synchronous so setQueryData batches with React state
      qc.cancelQueries({ queryKey: ['tasks'] })

      const previousAllTasks = qc.getQueryData<Task[]>(['tasks', 'all'])
      const previousProjectTasks = qc.getQueryData<Task[]>(['tasks', projectName])

      qc.setQueryData<Task[]>(['tasks', 'all'], (old) =>
        old?.map((task) =>
          task.fileName === taskFile && task.project === projectName
            ? { ...task, metadata: { ...task.metadata, status } }
            : task
        )
      )

      qc.setQueryData<Task[]>(['tasks', projectName], (old) =>
        old?.map((task) =>
          task.fileName === taskFile
            ? { ...task, metadata: { ...task.metadata, status } }
            : task
        )
      )

      return { previousAllTasks, previousProjectTasks }
    },
    onError: (_err, { projectName }, context) => {
      if (context?.previousAllTasks) {
        qc.setQueryData(['tasks', 'all'], context.previousAllTasks)
      }
      if (context?.previousProjectTasks) {
        qc.setQueryData(['tasks', projectName], context.previousProjectTasks)
      }
    },
    onSuccess: (updatedTask) => {
      // Patch cache with confirmed server data — no invalidation, no refetch
      qc.setQueryData<Task[]>(['tasks', 'all'], (old) => patchTaskInList(old, updatedTask))
      qc.setQueryData<Task[]>(['tasks', updatedTask.project], (old) => patchTaskInList(old, updatedTask))
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectName, taskFile }: { projectName: string; taskFile: string }) =>
      deleteTask(projectName, taskFile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
