import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchProjects,
  fetchProject,
  createProject,
  updateProject,
  deleteProject,
} from '@/services/projects'

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })
}

export function useProject(name: string) {
  return useQuery({
    queryKey: ['projects', name],
    queryFn: () => fetchProject(name),
    enabled: !!name,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; title?: string; description?: string; tags?: string[]; color?: string; icon?: string; content?: string }) =>
      createProject(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, ...updates }: { name: string; title?: string; description?: string; tags?: string[]; color?: string; icon?: string; content?: string }) =>
      updateProject(name, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => deleteProject(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
