import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as botService from '@/services/bot'

export function useBotStatus() {
  return useQuery({
    queryKey: ['bot-status'],
    queryFn: botService.getBotStatus,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

export function useBotMemories(query?: string) {
  return useQuery({
    queryKey: ['bot-memories', query],
    queryFn: () => botService.getBotMemories(query),
    retry: 1,
  })
}

export function useCreateMemory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ content, category }: { content: string; category?: string }) =>
      botService.createMemory(content, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-memories'] })
      queryClient.invalidateQueries({ queryKey: ['bot-status'] })
    },
  })
}

export function useDeleteMemory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => botService.deleteMemory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-memories'] })
      queryClient.invalidateQueries({ queryKey: ['bot-status'] })
    },
  })
}

export function useBotSchedules() {
  return useQuery({
    queryKey: ['bot-schedules'],
    queryFn: botService.getBotSchedules,
    retry: 1,
  })
}

export function useCreateSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cronExpression, prompt, chatId }: { cronExpression: string; prompt: string; chatId: number }) =>
      botService.createSchedule(cronExpression, prompt, chatId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['bot-status'] })
    },
  })
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => botService.deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['bot-status'] })
    },
  })
}

export function useToggleSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      botService.toggleSchedule(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['bot-status'] })
    },
  })
}

export function useBotTools() {
  return useQuery({
    queryKey: ['bot-tools'],
    queryFn: botService.getBotTools,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}

export function useBotChat() {
  return useMutation({
    mutationFn: (message: string) => botService.sendBotChat(message),
  })
}
