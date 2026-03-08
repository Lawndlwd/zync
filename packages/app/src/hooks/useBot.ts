import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as botService from '@/services/bot'
import type { BriefingConfig, ToolConfig } from '@zync/shared/types'

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

// --- New hooks ---

export function useBotChannels() {
  return useQuery({
    queryKey: ['bot-channels'],
    queryFn: botService.getBotChannels,
    staleTime: 10_000,
    retry: 1,
  })
}

export function useChannelConfig() {
  return useQuery({
    queryKey: ['channel-config'],
    queryFn: botService.getChannelConfig,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useSaveChannelConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ channel, config }: { channel: string; config: Record<string, unknown> }) =>
      botService.saveChannelConfig(channel, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-config'] })
    },
  })
}

export function useConnectChannel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (channel: string) => botService.connectChannel(channel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-channels'] })
      queryClient.invalidateQueries({ queryKey: ['bot-status'] })
    },
  })
}

export function useDisconnectChannel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (channel: string) => botService.disconnectChannel(channel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-channels'] })
      queryClient.invalidateQueries({ queryKey: ['bot-status'] })
    },
  })
}

export function useWhatsAppQR(enabled: boolean) {
  return useQuery({
    queryKey: ['whatsapp-qr'],
    queryFn: botService.getWhatsAppQR,
    enabled,
    refetchInterval: 3000,
    retry: 1,
  })
}


export function useBriefingConfig() {
  return useQuery({
    queryKey: ['briefing-config'],
    queryFn: botService.getBriefingConfig,
    staleTime: 60_000,
    retry: 1,
  })
}

export function useUpdateBriefingConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (config: BriefingConfig) => botService.updateBriefingConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['briefing-config'] })
      queryClient.invalidateQueries({ queryKey: ['bot-status'] })
    },
  })
}

export function useTriggerBriefing() {
  return useMutation({
    mutationFn: (type: 'morning' | 'evening') => botService.triggerBriefing(type),
  })
}

export function useBotToolConfig() {
  return useQuery({
    queryKey: ['bot-tool-config'],
    queryFn: botService.getBotToolConfig,
    staleTime: 60_000,
    retry: 1,
  })
}

export function useUpdateToolConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (config: ToolConfig) => botService.updateBotToolConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-tool-config'] })
    },
  })
}

export function useBotRecommendations() {
  return useQuery({
    queryKey: ['bot-recommendations'],
    queryFn: botService.getBotRecommendations,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
