const API = '/api/widgets'

export type WidgetType = 'weather' | 'football' | 'news' | 'finance'

export interface Widget {
  id: number
  type: WidgetType
  settings: Record<string, any>
  cached_data: any | null
  last_refreshed: string | null
  created_at: string
}

export interface FootballLeague {
  slug: string
  name: string
}

export async function fetchWidgets(): Promise<Widget[]> {
  const res = await fetch(API)
  if (!res.ok) throw new Error(`Widgets error: ${res.status}`)
  return res.json()
}

export async function createWidget(type: WidgetType, settings: Record<string, any>): Promise<Widget> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, settings }),
  })
  if (!res.ok) throw new Error(`Create widget error: ${res.status}`)
  return res.json()
}

export async function updateWidget(id: number, settings: Record<string, any>): Promise<Widget> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  })
  if (!res.ok) throw new Error(`Update widget error: ${res.status}`)
  return res.json()
}

export async function deleteWidget(id: number): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete widget error: ${res.status}`)
}

export async function refreshWidget(id: number): Promise<Widget> {
  const res = await fetch(`${API}/${id}/refresh`, { method: 'POST' })
  if (!res.ok) throw new Error(`Refresh widget error: ${res.status}`)
  return res.json()
}

export async function refreshAllWidgets(): Promise<{ refreshed: number }> {
  const res = await fetch(`${API}/refresh-all`, { method: 'POST' })
  if (!res.ok) throw new Error(`Refresh all error: ${res.status}`)
  return res.json()
}

export async function fetchFootballLeagues(): Promise<FootballLeague[]> {
  const res = await fetch(`${API}/football/leagues`)
  if (!res.ok) throw new Error(`Leagues error: ${res.status}`)
  return res.json()
}
