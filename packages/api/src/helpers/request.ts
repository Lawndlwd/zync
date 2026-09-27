import type { Request } from 'express'

/** The `*path` wildcard of a route as a '/'-separated workspace-relative path. */
export function relPath(req: Request): string {
  const p = (req.params as Record<string, string | string[]>).path
  return Array.isArray(p) ? p.join('/') : p || ''
}
