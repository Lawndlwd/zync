import type { Response } from 'express'

export function errorResponse(res: Response, err: unknown, status = 500): void {
  const message = err instanceof Error ? err.message : 'Internal server error'
  const safe = process.env.NODE_ENV === 'production' ? 'Internal server error' : message
  res.status(status).json({ error: safe })
}
