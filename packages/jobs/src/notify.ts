import type { RunRecord } from './runs.js'

export type NotifyTarget = {
  workspace: string
  job: string
  run: RunRecord
  link?: string
}

export type Push = {
  title: string
  body: string
  /** ntfy tags, shown as emoji. */
  tags: string
  priority?: 'default' | 'high'
  /** Opened when the notification is tapped. */
  link?: string | undefined
}

/** Push a notification via ntfy (ntfy.sh or self-hosted). No-op when not configured. */
export async function push({ title, body, tags, priority = 'default', link }: Push): Promise<void> {
  const base = process.env.NTFY_URL?.replace(/\/$/, '')
  const topic = process.env.NTFY_TOPIC
  if (!base || !topic) return
  // Header values must stay ASCII (fetch rejects others); ntfy renders tags as emoji.
  const headers: Record<string, string> = { Title: title, Tags: tags, Priority: priority }
  if (link) headers.Click = link
  if (process.env.NTFY_TOKEN) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`
  try {
    const res = await fetch(`${base}/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers,
      body: body.slice(0, 300),
    })
    if (!res.ok) console.error(`[notify] ntfy responded ${res.status}`)
  } catch (err) {
    console.error('[notify] failed:', err)
  }
}

/** A job's run, pushed. */
export async function notify({ workspace, job, run, link }: NotifyTarget): Promise<void> {
  const ok = run.status === 'ok'
  await push({
    title: `${job} (${workspace}): ${run.status}`,
    tags: ok ? 'white_check_mark,robot' : 'x,warning',
    priority: ok ? 'default' : 'high',
    link,
    body: run.summary || '(no output)',
  })
}

export function shouldNotify(policy: 'always' | 'failure' | 'never', run: RunRecord): boolean {
  if (policy === 'never') return false
  if (policy === 'failure') return run.status !== 'ok'
  return true
}

/** Link to a page of the app, e.g. `appLink("personal", "overview")`; none without APP_URL. */
export function appLink(workspace: string, view: string): string | undefined {
  const app = process.env.APP_URL?.replace(/\/$/, '')
  return app ? `${app}/w/${encodeURIComponent(workspace)}/${view}` : undefined
}

/** Link that opens the run's session inside the app's Chat view. */
export function sessionLink(workspace: string, sessionId?: string): string | undefined {
  const app = process.env.APP_URL?.replace(/\/$/, '')
  if (!app || !sessionId) return undefined
  return `${app}/w/${encodeURIComponent(workspace)}/chat?session=${encodeURIComponent(sessionId)}`
}
