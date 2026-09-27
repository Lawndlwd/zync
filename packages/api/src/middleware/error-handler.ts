import { codeOf, errorMessage, statusOf } from '@zync/jobs'
import type { NextFunction, Request, Response } from 'express'

const field = (err: unknown, key: string): unknown =>
  typeof err === 'object' && err !== null ? Reflect.get(err, key) : undefined

/** Node file-system errors that mean the request was wrong, not the server. */
const CODE_STATUS: Partial<Record<string, number>> = { ENOENT: 404, EEXIST: 409, ENOTDIR: 400 }

function statusFor(err: unknown, invalid: boolean): number {
  if (invalid) return 400
  const status = statusOf(err)
  if (status !== undefined) return status
  // Express's own errors (body too large, bad JSON) carry `statusCode`.
  const statusCode = field(err, 'statusCode')
  if (typeof statusCode === 'number') return statusCode
  return CODE_STATUS[codeOf(err) ?? ''] ?? 500
}

/**
 * Every error thrown by a route ends here: ZodError → 400 with the issues, `status` → itself,
 * ENOENT → 404, EEXIST → 409, anything else → 500 (logged). The body is `{ error }`, plus the
 * current `mtime` for conflicts that carry one, and `stepUp` when a fresh passkey check is needed.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const invalid = field(err, 'name') === 'ZodError'
  const status = statusFor(err, invalid)
  if (status >= 500) console.error(err)
  const message = field(err, 'message')
  const mtime = field(err, 'mtime')
  const retryAfter = field(err, 'retryAfter')
  if (typeof retryAfter === 'number') res.setHeader('Retry-After', String(Math.ceil(retryAfter / 1000)))
  res.status(status).json({
    error: invalid ? errorMessage(err) : typeof message === 'string' ? message : 'Internal error',
    ...(typeof mtime === 'number' ? { mtime } : {}),
    ...(field(err, 'stepUp') === true ? { stepUp: true } : {}),
  })
}
