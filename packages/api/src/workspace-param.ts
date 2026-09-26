import { resolveWorkspace, type Workspace } from '@zync/jobs'
import type { Request } from 'express'

export async function wsOf(req: Request): Promise<Workspace> {
  const name = String((req.params as Record<string, string>).ws || '')
  try {
    return await resolveWorkspace(name, req.app.get('workspacesRoot'))
  } catch (err) {
    throw Object.assign(err as Error, { status: 404 })
  }
}
