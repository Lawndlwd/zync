export interface TelegramDM {
  id: number
  telegram_user_id: string
  username: string | null
  display_name: string | null
  message_text: string
  category: string
  auto_replied: number
  reply_text: string | null
  business_connection_id: string | null
  created_at: string
}

export interface TelegramDMStats {
  total: number
  byCategory: Record<string, number>
}

export interface TelegramConfig {
  channelId: string
  dmAutoReply: boolean
  supportRateLimit: number
}

const API_BASE = '/api/telegram'

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Telegram API error: ${res.status} - ${text}`)
  }
  return res.json()
}

export async function fetchTelegramDMs(params?: {
  category?: string
  limit?: number
  offset?: number
}): Promise<{ dms: TelegramDM[] }> {
  const query = new URLSearchParams()
  if (params?.category) query.set('category', params.category)
  if (params?.limit != null) query.set('limit', String(params.limit))
  if (params?.offset != null) query.set('offset', String(params.offset))
  return fetchJSON(`${API_BASE}/dms?${query}`)
}

export async function fetchTelegramDMStats(): Promise<TelegramDMStats> {
  return fetchJSON(`${API_BASE}/dms/stats`)
}

export async function replyToDM(id: number, text: string): Promise<void> {
  await fetchJSON(`${API_BASE}/dms/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export async function crossPostToTelegram(
  content: string,
  mediaUrl?: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  return fetchJSON(`${API_BASE}/crosspost`, {
    method: 'POST',
    body: JSON.stringify({ content, mediaUrl }),
  })
}

export async function fetchTelegramConfig(): Promise<TelegramConfig> {
  return fetchJSON(`${API_BASE}/config`)
}

export async function saveTelegramConfig(config: Partial<TelegramConfig>): Promise<void> {
  await fetchJSON(`${API_BASE}/config`, {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

export async function reloadTelegramPrompt(): Promise<void> {
  await fetchJSON(`${API_BASE}/reload-prompt`, { method: 'POST' })
}
