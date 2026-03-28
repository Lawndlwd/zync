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
  gmail?: {
    clientId: string
    hasClientSecret: boolean
    authorized: boolean
    pollIntervalMs: number
    enabledServices?: string[]
  }
}

export interface WhatsAppQRResponse {
  qr: string | null
  state: string
  error: string | null
}

export interface BriefingCheckItem {
  id: string
  label: string
  enabled: boolean
}

export const DEFAULT_MORNING_ITEMS: BriefingCheckItem[] = [
  { id: 'lifeos', label: 'Life OS snapshot', enabled: true },
  { id: 'levers', label: 'Daily levers', enabled: true },
  { id: 'goals', label: 'Active goals & projects', enabled: true },
  { id: 'calendar', label: 'Calendar events', enabled: true },
  { id: 'emails', label: 'Email digest', enabled: true },
  { id: 'motivation', label: 'Motivational nudge', enabled: true },
]

export const DEFAULT_EVENING_ITEMS: BriefingCheckItem[] = [
  { id: 'lifeos', label: 'Life OS daily review', enabled: true },
  { id: 'levers', label: 'Lever completion', enabled: true },
  { id: 'goals', label: 'Goal progress', enabled: true },
  { id: 'journal', label: 'Journal check', enabled: true },
  { id: 'emails', label: 'Email update', enabled: true },
]

export interface BriefingConfig {
  morningCron: string
  eveningCron: string
  channel: string
  chatId: string
  enabled: boolean
  morningItems: BriefingCheckItem[]
  eveningItems: BriefingCheckItem[]
  morningInstructions: string
  eveningInstructions: string
}

export interface ToolConfig {
  shell: { allowlist: string[]; timeout_ms: number; max_output_bytes: number }
  files: { allowed_paths: string[]; max_file_size_bytes: number }
}
