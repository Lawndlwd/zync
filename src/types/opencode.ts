export interface OpenCodeSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface OpenCodeTokens {
  input: number
  output: number
  reasoning: number
  cache: { read: number; write: number }
}

export interface OpenCodeMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  parts: OpenCodePart[]
  createdAt: string
  cost?: number
  tokens?: OpenCodeTokens
  modelId?: string
}

export type OpenCodePart =
  | { type: 'text'; text: string }
  | { type: 'tool-invocation'; toolInvocation: { id: string; toolName: string; args: Record<string, unknown>; state: string; result?: unknown } }

export interface OpenCodeProvider {
  id: string
  name: string
  models: OpenCodeModel[]
}

export interface OpenCodeModel {
  id: string
  name: string
  provider: string
}

export interface OpenCodeConnectionStatus {
  connected: boolean
  serverUrl: string
  error?: string
}
