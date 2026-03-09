import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as memoryService from '@/services/memory'

export function useProfile() {
  return useQuery({
    queryKey: ['memory-profile'],
    queryFn: memoryService.getProfile,
    retry: 1,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ section, content }: { section: string; content: string }) =>
      memoryService.updateProfile(section, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory-profile'] })
    },
  })
}

export function useInstructions() {
  return useQuery({
    queryKey: ['memory-instructions'],
    queryFn: memoryService.getInstructions,
    retry: 1,
  })
}

export function useAddInstruction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => memoryService.addInstruction(content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory-instructions'] })
    },
  })
}

export function useUpdateInstruction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; content?: string; active?: boolean }) =>
      memoryService.updateInstruction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory-instructions'] })
    },
  })
}

export function useDeleteInstruction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => memoryService.deleteInstruction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory-instructions'] })
    },
  })
}

export function useMemories(query?: string, category?: string) {
  return useQuery({
    queryKey: ['memory-memories', query, category],
    queryFn: () => memoryService.getMemories({ q: query, category }),
    retry: 1,
  })
}

export function useDeleteMemory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => memoryService.deleteMemoryEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory-memories'] })
    },
  })
}

export function useMemoryCategories() {
  return useQuery({
    queryKey: ['memory-categories'],
    queryFn: memoryService.getCategories,
    retry: 1,
  })
}
