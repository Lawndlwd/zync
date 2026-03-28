export interface AgentModelConfig {
  opencode?: { model: string } // "providerID/modelID" for OpenCode Chat
  bot?: { model: string } // "providerID/modelID" for Telegram Bot
}

export interface AppSettings {
  messages: {
    source: 'slack' | 'custom'
    webhookUrl: string
    customEndpoint: string
  }
}

export const defaultSettings: AppSettings = {
  messages: {
    source: 'custom',
    webhookUrl: '',
    customEndpoint: '',
  },
}
