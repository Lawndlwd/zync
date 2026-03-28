const API_BASE = '/api/llm'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface StreamCallbacks {
  onToken: (token: string) => void
  onThinking?: (content: string) => void
  onToolCall?: (toolCall: { id: string; name: string; arguments: Record<string, unknown> }) => void
  onToolResult?: (result: { toolCallId: string; toolName: string; result: string }) => void
  onUsage?: (usage: TokenUsage) => void
  onDone: () => void
  onError: (error: Error) => void
}

export async function chatCompletion(
  messages: LLMMessage[],
  tools?: string[],
): Promise<{ content: string; usage?: TokenUsage }> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, ...(tools && { tools }) }),
  })
  if (!res.ok) throw new Error(`LLM error: ${res.status}`)
  return res.json()
}

export async function streamChat(messages: LLMMessage[], callbacks: StreamCallbacks, tools?: string[]) {
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, ...(tools && { tools }) }),
  })

  if (!res.ok) {
    callbacks.onError(new Error(`LLM error: ${res.status}`))
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    callbacks.onError(new Error('No response body'))
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') {
        callbacks.onDone()
        return
      }
      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'token') {
          callbacks.onToken(parsed.content)
        } else if (parsed.type === 'thinking') {
          if (callbacks.onThinking) callbacks.onThinking(parsed.content)
        } else if (parsed.type === 'tool_call') {
          if (callbacks.onToolCall) callbacks.onToolCall(parsed.toolCall)
        } else if (parsed.type === 'tool_result' && callbacks.onToolResult) {
          callbacks.onToolResult(parsed)
        } else if (parsed.type === 'usage' && callbacks.onUsage) {
          callbacks.onUsage(parsed.usage)
        }
      } catch {
        // skip malformed lines
      }
    }
  }
  callbacks.onDone()
}
