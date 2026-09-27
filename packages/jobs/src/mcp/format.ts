import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

import { type Card } from '../boards/index.js'
import { errorMessage } from '../errors.js'
import { defaultTimezone } from '../helpers/dates.js'
import { type Job, nextRuns } from '../job-file.js'

// How MCP tools answer: pretty JSON (or plain text) on success, the error message on failure.

const ok = (data: unknown): CallToolResult => ({
  content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
})

const fail = (err: unknown): CallToolResult => ({ isError: true, content: [{ type: 'text', text: errorMessage(err) }] })

/** A tool handler that returns its result (or throws); the answer is formatted by `ok`/`fail`. */
export const safe =
  <A>(fn: (args: A) => Promise<unknown>) =>
  async (args: A): Promise<CallToolResult> => {
    try {
      return ok(await fn(args))
    } catch (err) {
      return fail(err)
    }
  }

export function definedOnly(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value
  }
  return result
}

export function describeJob(job: Job) {
  const tz = job.timezone || defaultTimezone()
  const runs = nextRuns(job).map((d) =>
    d.toLocaleString('en-GB', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' }),
  )
  return {
    name: job.name,
    when: job.schedule ? `cron "${job.schedule}"` : `once at ${job.at}`,
    timezone: tz,
    enabled: job.enabled,
    nextRuns: runs,
    warning: job.enabled && runs.length === 0 ? 'This job will never run (date in the past?)' : undefined,
  }
}

export function cardSummary(c: Card) {
  return {
    file: c.file,
    title: c.title,
    status: c.status,
    assignee: c.assignee ?? null,
    due: c.due,
    duration: c.duration,
    labels: c.labels.length ? c.labels : undefined,
    runAt: c.runAt,
    ai: c.ai,
  }
}
