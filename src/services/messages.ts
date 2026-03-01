import type { Message } from '@/types/message'

const API_BASE = '/api/messages'

export async function fetchMessages(): Promise<Message[]> {
  const res = await fetch(API_BASE)
  if (!res.ok) throw new Error(`Messages API error: ${res.status}`)
  return res.json()
}

export async function markAsRead(id: string): Promise<void> {
  await fetch(`${API_BASE}/${id}/read`, { method: 'PATCH' })
}

export async function archiveMessage(id: string): Promise<void> {
  await fetch(`${API_BASE}/${id}/archive`, { method: 'PATCH' })
}
