export interface SetupStatus {
  initialized: boolean
  vaultStatus: 'available' | 'uninitialized'
  hasPin: boolean
  requiredSteps: string[]
  configuredIntegrations: Record<string, boolean>
  configuredSettings: Record<string, boolean>
}

export interface VerifyResult {
  ok: boolean
  message?: string
  username?: string
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Setup API error: ${res.status} - ${text}`)
  }
  return res.json()
}

export async function getSetupStatus(): Promise<SetupStatus> {
  return fetchJSON('/api/setup/status')
}

export async function completeSetup(): Promise<{ success: boolean }> {
  return fetchJSON('/api/setup/complete', { method: 'POST' })
}

export async function verifyIntegration(
  service: string,
  config: Record<string, unknown>
): Promise<VerifyResult> {
  return fetchJSON('/api/setup/verify', {
    method: 'POST',
    body: JSON.stringify({ service, config }),
  })
}
