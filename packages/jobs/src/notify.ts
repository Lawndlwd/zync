import type { RunRecord } from './runs.js'

export interface NotifyTarget {
  workspace: string
  job: string
  run: RunRecord
  link?: string
}

/** Push a notification via ntfy (ntfy.sh or self-hosted). No-op when not configured. */
export async function notify({ workspace, job, run, link }: NotifyTarget): Promise<void> {
  const base = process.env.NTFY_URL?.replace(/\/$/, '')
  const topic = process.env.NTFY_TOPIC
  if (!base || !topic) return

  const ok = run.status === 'ok'
  const headers: Record<string, string> = {
    // Header values must stay ASCII (fetch rejects others); ntfy renders tags as emoji.
    Title: `${job} (${workspace}): ${run.status}`,
    Tags: ok ? 'white_check_mark,robot' : 'x,warning',
    Priority: ok ? 'default' : 'high',
  }
  if (link) headers.Click = link
  if (process.env.NTFY_TOKEN) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`

  const body = (run.summary || '(no output)').slice(0, 300)
  try {
    const res = await fetch(`${base}/${encodeURIComponent(topic)}`, { method: 'POST', headers, body })
    if (!res.ok) console.error(`[notify] ntfy responded ${res.status}`)
  } catch (err) {
    console.error('[notify] failed:', err)
  }
}

export function shouldNotify(policy: 'always' | 'failure' | 'never', run: RunRecord): boolean {
  if (policy === 'never') return false
  if (policy === 'failure') return run.status !== 'ok'
  return true
}

/** Link that opens the run's session inside the app's Chat view. */
export function sessionLink(workspace: string, sessionId?: string): string | undefined {
  const app = process.env.APP_URL?.replace(/\/$/, '')
  if (!app || !sessionId) return undefined
  return `${app}/w/${encodeURIComponent(workspace)}/chat?session=${encodeURIComponent(sessionId)}`
}
