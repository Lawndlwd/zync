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
  channels?: string[]
  skillsCount?: number
  briefingEnabled?: boolean
}

export interface BotChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChannelStatus {
  channel: 'telegram' | 'whatsapp' | 'gmail'
  connected: boolean
  configured: boolean
  connectionState: 'disconnected' | 'connecting' | 'connected'
}

export interface ChannelConfigResponse {
  telegram?: { botToken: string; allowedUsers: string; hasBotToken: boolean }
  whatsapp?: { allowedNumbers: string; autoReply: boolean; autoReplyInstructions: string }
  gmail?: { clientId: string; hasClientSecret: boolean; authorized: boolean; pollIntervalMs: number }
}

export interface WhatsAppQRResponse {
  qr: string | null
  state: string
  error: string | null
}

export interface SkillInfo {
  name: string
  description: string
  triggers: string[]
}

export interface BriefingConfig {
  morningCron: string
  eveningCron: string
  channel: string
  chatId: string
  enabled: boolean
}

export interface ToolConfig {
  shell: { allowlist: string[]; timeout_ms: number; max_output_bytes: number }
  files: { allowed_paths: string[]; max_file_size_bytes: number }
}
