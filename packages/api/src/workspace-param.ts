import { errorMessage, notFound, resolveWorkspace, type Workspace } from '@zync/jobs'
import type { Request } from 'express'

export async function wsOf(req: Request): Promise<Workspace> {
  const name = (req.params as { ws?: string }).ws ?? ''
  try {
    return await resolveWorkspace(name, req.app.get('workspacesRoot'))
  } catch (err) {
    throw notFound(errorMessage(err))
  }
}
