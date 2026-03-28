export interface ConfigSetting {
  key: string
  value: string
  category: string
  updatedAt: string
}

export async function listConfig(category?: string): Promise<ConfigSetting[]> {
  const params = category ? `?category=${category}` : ''
  const res = await fetch(`/api/config${params}`)
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json()
}

export async function setConfig(key: string, value: string, category: string = 'general'): Promise<void> {
  const res = await fetch(`/api/config/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, category }),
  })
  if (!res.ok) throw new Error('Failed to save config')
}

export async function deleteConfig(key: string): Promise<void> {
  const res = await fetch(`/api/config/${encodeURIComponent(key)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete config')
}
