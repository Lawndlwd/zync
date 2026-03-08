import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as telegramService from '@/services/telegram'

export function useTelegramDMs(category?: string) {
  return useQuery({
    queryKey: ['telegram-dms', category],
    queryFn: () => telegramService.fetchTelegramDMs(category ? { category } : undefined),
    retry: 1,
  })
}

export function useTelegramDMStats() {
  return useQuery({
    queryKey: ['telegram-dm-stats'],
    queryFn: telegramService.fetchTelegramDMStats,
    retry: 1,
  })
}

export function useTelegramConfig() {
  return useQuery({
    queryKey: ['telegram-config'],
    queryFn: telegramService.fetchTelegramConfig,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useReplyToDM() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, text }: { id: number; text: string }) =>
      telegramService.replyToDM(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-dms'] })
      queryClient.invalidateQueries({ queryKey: ['telegram-dm-stats'] })
    },
  })
}

export function useCrossPostToTelegram() {
  return useMutation({
    mutationFn: ({ content, mediaUrl }: { content: string; mediaUrl?: string }) =>
      telegramService.crossPostToTelegram(content, mediaUrl),
  })
}

export function useSaveTelegramConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (config: Partial<telegramService.TelegramConfig>) =>
      telegramService.saveTelegramConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-config'] })
    },
  })
}

export function useReloadTelegramPrompt() {
  return useMutation({
    mutationFn: telegramService.reloadTelegramPrompt,
  })
}
