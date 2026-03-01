export interface BotMemory {
  id: number
  content: string
  category: string
  created_at: string
  rank?: number
}

export interface BotSchedule {
  id: number
  chat_id: number
  cron_expression: string
  prompt: string
  enabled: number
  created_at: string
}

export interface BotToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface BotStatus {
  memoryCount: number
  toolCount: number
  activeSchedules: number
  totalSchedules: number
  modelName: string
  providerName: string
  isLocal: boolean
}

export interface BotChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}
