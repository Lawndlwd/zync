import type { AgentModelConfig } from '@zync/shared/types'

const API_BASE = '/api/settings'

export async function fetchAgentModels(): Promise<AgentModelConfig> {
  const res = await fetch(`${API_BASE}/agent-models`)
  if (!res.ok) throw new Error(`Failed to fetch agent models: ${res.status}`)
  return res.json()
}

export async function saveAgentModels(config: AgentModelConfig): Promise<void> {
  const res = await fetch(`${API_BASE}/agent-models`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) throw new Error(`Failed to save agent models: ${res.status}`)
}
