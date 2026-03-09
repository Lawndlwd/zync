const API_BASE = '/api/memory'

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Memory API error: ${res.status} - ${text}`)
  }
  return res.json()
}

// --- Interfaces ---

export interface ProfileEntry {
  section: string
  content: string
  updated_at: string
}

export interface Instruction {
  id: number
  content: string
  source: 'explicit' | 'extracted'
  active: number
  created_at: string
  updated_at: string
}

export interface MemoryEntry {
  id: number
  content: string
  category: string
  source: string
  access_count: number
  last_accessed: string | null
  created_at: string
}

// --- Profile ---

export async function getProfile(): Promise<ProfileEntry[]> {
  return fetchJSON(`${API_BASE}/profile`)
}

export async function updateProfile(
  section: string,
  content: string,
): Promise<{ success: boolean }> {
  return fetchJSON(`${API_BASE}/profile/${encodeURIComponent(section)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
}

// --- Instructions ---

export async function getInstructions(): Promise<Instruction[]> {
  return fetchJSON(`${API_BASE}/instructions`)
}

export async function addInstruction(content: string): Promise<{ id: number }> {
  return fetchJSON(`${API_BASE}/instructions`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export async function updateInstruction(
  id: number,
  data: { content?: string; active?: boolean },
): Promise<{ success: boolean }> {
  return fetchJSON(`${API_BASE}/instructions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteInstruction(id: number): Promise<{ success: boolean }> {
  return fetchJSON(`${API_BASE}/instructions/${id}`, { method: 'DELETE' })
}

// --- Memories ---

export async function getMemories(params?: {
  q?: string
  category?: string
  limit?: number
}): Promise<MemoryEntry[]> {
  const searchParams = new URLSearchParams()
  if (params?.q) searchParams.set('q', params.q)
  if (params?.category) searchParams.set('category', params.category)
  if (params?.limit) searchParams.set('limit', String(params.limit))
  const qs = searchParams.toString()
  return fetchJSON(`${API_BASE}/memories${qs ? `?${qs}` : ''}`)
}

export async function getCategories(): Promise<string[]> {
  return fetchJSON(`${API_BASE}/memories/categories`)
}

export async function deleteMemoryEntry(id: number): Promise<{ success: boolean }> {
  return fetchJSON(`${API_BASE}/memories/${id}`, { method: 'DELETE' })
}
