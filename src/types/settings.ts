export interface AgentModelConfig {
  prAgent?: { model: string }   // "providerID/modelID" for PR-Agent
  opencode?: { model: string }  // "providerID/modelID" for OpenCode Chat
  bot?: { model: string }       // "providerID/modelID" for Telegram Bot
}

export interface AppSettings {
  jira: {
    baseUrl: string
    email: string
    apiToken: string
    projectKey: string
    defaultJql: string
    boardId: number | null
  }
  gitlab: {
    baseUrl: string
    pat: string
    defaultProjectId: number | null
    username: string
    localRepoPaths: Record<string, string>
  }
  messages: {
    source: 'slack' | 'custom'
    webhookUrl: string
    customEndpoint: string
  }
}

export const defaultSettings: AppSettings = {
  jira: {
    baseUrl: '',
    email: '',
    apiToken: '',
    projectKey: '',
    defaultJql: 'assignee = currentUser() ORDER BY updated DESC',
    boardId: null,
  },
  gitlab: {
    baseUrl: '',
    pat: '',
    defaultProjectId: null,
    username: '',
    localRepoPaths: {},
  },
  messages: {
    source: 'custom',
    webhookUrl: '',
    customEndpoint: '',
  },
}
