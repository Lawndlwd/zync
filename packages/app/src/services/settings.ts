export async function fetchServerSettings(): Promise<{
  jira: { baseUrl: string; email: string; apiToken: string; projectKey: string }
  gitlab: { baseUrl: string; pat: string }
  github: { baseUrl: string; pat: string }
  llm: { baseUrl: string; model: string; apiKey: string }
  messages: { customEndpoint: string }
  linear: { apiKey: string; defaultTeamId: string }
}> {
  const res = await fetch('/api/settings', {
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Settings API error: ${res.status} - ${text}`)
  }
  return res.json()
}
