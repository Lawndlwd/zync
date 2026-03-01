import type { BotStatus, BotMemory, BotSchedule, BotToolDefinition } from '@/types/bot'

const API_BASE = '/api/bot'

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Bot API error: ${res.status} - ${text}`)
  }
  return res.json()
}

export async function getBotStatus(): Promise<BotStatus> {
  return fetchJSON<BotStatus>(`${API_BASE}/status`)
}

export async function getBotMemories(query?: string, limit = 50): Promise<BotMemory[]> {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  params.set('limit', String(limit))
  return fetchJSON<BotMemory[]>(`${API_BASE}/memories?${params}`)
}

export async function createMemory(content: string, category?: string): Promise<{ id: number }> {
  return fetchJSON<{ id: number }>(`${API_BASE}/memories`, {
    method: 'POST',
    body: JSON.stringify({ content, category }),
  })
}

export async function deleteMemory(id: number): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(`${API_BASE}/memories/${id}`, {
    method: 'DELETE',
  })
}

export async function getBotSchedules(): Promise<BotSchedule[]> {
  return fetchJSON<BotSchedule[]>(`${API_BASE}/schedules`)
}

export async function createSchedule(cronExpression: string, prompt: string, chatId: number): Promise<BotSchedule> {
  return fetchJSON<BotSchedule>(`${API_BASE}/schedules`, {
    method: 'POST',
    body: JSON.stringify({ cron_expression: cronExpression, prompt, chat_id: chatId }),
  })
}

export async function deleteSchedule(id: number): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(`${API_BASE}/schedules/${id}`, {
    method: 'DELETE',
  })
}

export async function toggleSchedule(id: number, enabled: boolean): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(`${API_BASE}/schedules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  })
}

export async function getBotTools(): Promise<BotToolDefinition[]> {
  return fetchJSON<BotToolDefinition[]>(`${API_BASE}/tools`)
}

export async function sendBotChat(message: string): Promise<{ response: string }> {
  return fetchJSON<{ response: string }>(`${API_BASE}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}
