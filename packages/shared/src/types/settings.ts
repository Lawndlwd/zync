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
  github: {
    baseUrl: string
    pat: string
    defaultRepo: string
    username: string
    localRepoPaths: Record<string, string>
  }
  messages: {
    source: 'slack' | 'custom'
    webhookUrl: string
    customEndpoint: string
  }
  linear: {
    apiKey: string
    defaultTeamId: string
  }
  social: {
    instagram: { appId: string; appSecret: string; accessToken: string; connected: boolean; username: string; enabled: boolean }
    x: { username: string; password: string; enabled: boolean }
    youtube: { email: string; password: string; channelHandle: string; enabled: boolean }
    telegram: { channelId: string; enabled: boolean }
    syncIntervalMinutes: number
    autoReplyEnabled: boolean
    autoReplyPrompt: string
    autoReplyRequireApproval: boolean
    features: {
      contentComposer: boolean
      unifiedInbox: boolean
      analytics: boolean
      contentCalendar: boolean
      autoReply: boolean
      aiSuggestions: boolean
    }
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
  github: {
    baseUrl: 'https://api.github.com',
    pat: '',
    defaultRepo: '',
    username: '',
    localRepoPaths: {},
  },
  messages: {
    source: 'custom',
    webhookUrl: '',
    customEndpoint: '',
  },
  linear: {
    apiKey: '',
    defaultTeamId: '',
  },
  social: {
    instagram: { appId: '', appSecret: '', accessToken: '', connected: false, username: '', enabled: false },
    x: { username: '', password: '', enabled: false },
    youtube: { email: '', password: '', channelHandle: '', enabled: false },
    telegram: { channelId: '', enabled: false },
    syncIntervalMinutes: 30,
    autoReplyEnabled: false,
    autoReplyPrompt: 'You are replying to Instagram comments on my behalf. Be friendly, genuine and brief (1-2 sentences max). Match the language of the comment. No hashtags. No emoji overload.',
    autoReplyRequireApproval: true,
    features: {
      contentComposer: true,
      unifiedInbox: true,
      analytics: true,
      contentCalendar: true,
      autoReply: false,
      aiSuggestions: true,
    },
  },
}
