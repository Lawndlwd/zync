async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export interface SecretMeta {
  name: string
  category: string
  createdAt: string
  updatedAt: string
}

export interface VaultStatus {
  available: boolean
  hasPin: boolean
}

export async function getVaultStatus(): Promise<VaultStatus> {
  return fetchJSON('/api/secrets/status')
}

export async function listSecrets(category?: string): Promise<SecretMeta[]> {
  const params = category ? `?category=${encodeURIComponent(category)}` : ''
  return fetchJSON(`/api/secrets${params}`)
}

export async function setSecret(name: string, value: string, category: string = 'general'): Promise<void> {
  await fetchJSON('/api/secrets', {
    method: 'PUT',
    body: JSON.stringify({ name, value, category }),
  })
}

export async function deleteSecret(name: string): Promise<void> {
  await fetchJSON(`/api/secrets/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

export async function revealSecret(name: string, auth: { pin: string } | { secretKey: string }): Promise<string> {
  const res = await fetch(`/api/secrets/${encodeURIComponent(name)}/reveal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(auth),
  })
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Invalid credentials')
  }
  if (res.status === 404) throw new Error('Secret not found')
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data = await res.json()
  return data.value
}

export async function setVaultPin(pin: string): Promise<void> {
  await fetchJSON('/api/secrets/pin', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  })
}
