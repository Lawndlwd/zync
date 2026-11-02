import { httpError } from '@zync/jobs'
import type { z } from 'zod'

// Calls to Google, Slack…: JSON in, JSON checked against a schema out. A service that refuses answers
// 502 with its own words, so Settings and the AI can say what went wrong (expired token, missing scope).

type Init = { token?: string; method?: 'GET' | 'POST'; form?: Record<string, string> }

export async function fetchJson<S extends z.ZodType>(url: string, schema: S, init: Init = {}): Promise<z.infer<S>> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (init.token) headers.Authorization = `Bearer ${init.token}`
  const res = await fetch(url, {
    method: init.method ?? (init.form ? 'POST' : 'GET'),
    headers,
    ...(init.form ? { body: new URLSearchParams(init.form) } : {}),
    signal: AbortSignal.timeout(20_000),
  })
  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw httpError(502, `${new URL(url).host} answered ${res.status} (not JSON)`)
  }
  if (!res.ok) throw httpError(502, `${new URL(url).host} answered ${res.status}: ${reason(body)}`)
  return schema.parse(body)
}

/** The service's own error message, when it has one. */
function reason(body: unknown): string {
  if (typeof body !== 'object' || body === null) return 'error'
  const error: unknown = Reflect.get(body, 'error')
  const description: unknown = Reflect.get(body, 'error_description')
  if (typeof description === 'string') return description
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null) {
    const message: unknown = Reflect.get(error, 'message')
    if (typeof message === 'string') return message
  }
  return 'error'
}
