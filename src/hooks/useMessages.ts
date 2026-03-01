import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as messagesService from '@/services/messages'

export function useMessages() {
  return useQuery({
    queryKey: ['messages'],
    queryFn: messagesService.fetchMessages,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: messagesService.markAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages'] }),
  })
}

export function useArchiveMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: messagesService.archiveMessage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages'] }),
  })
}
