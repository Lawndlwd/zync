// Security events pushed to your phone (ntfy), so a sign-in you didn't make is noticed right away.
// Never blocks or fails the request; without NTFY_TOPIC it only logs.

export type Alert = (title: string, message: string) => void

export function ntfyAlert(env: NodeJS.ProcessEnv, fetchFn: typeof fetch = fetch): Alert {
  const topic = env.NTFY_TOPIC
  const base = (env.NTFY_URL || 'https://ntfy.sh').replace(/\/$/, '')
  return (title, message) => {
    console.warn(`[auth] ${title}: ${message}`)
    if (!topic) return
    const headers: Record<string, string> = { Title: `zync · ${title}`, Priority: 'high', Tags: 'lock' }
    if (env.NTFY_TOKEN) headers.Authorization = `Bearer ${env.NTFY_TOKEN}`
    fetchFn(`${base}/${encodeURIComponent(topic)}`, { method: 'POST', headers, body: message }).catch((err: unknown) =>
      console.error('[auth] alert not sent:', err),
    )
  }
}
