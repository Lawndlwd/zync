import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router'

import { api } from '../api'
import { readPref } from '../shell/prefs'
import { NewWorkspaceForm } from './NewWorkspaceForm'

export function Home() {
  const { data, isLoading, error } = useQuery({ queryKey: ['workspaces'], queryFn: api.workspaces })
  if (data?.length) {
    const last = readPref('zync:lastWorkspace', '')
    const target = data.find((w) => w.name === last) ?? data[0]
    if (target) return <Navigate to={`/w/${encodeURIComponent(target.name)}/overview`} replace />
  }
  return (
    <div className="z app-root welcome">
      <div className="welcome-in col g24">
        <div className="wordmark">
          <i />
          ZYNC
        </div>
        {isLoading ? (
          <div className="skel" style={{ height: 56, width: 320 }} />
        ) : error ? (
          <p className="lede danger-t">{error.message}</p>
        ) : (
          <>
            <div className="col g12">
              <h1 className="display">Start a workspace</h1>
              <p className="lede">
                A workspace is a <b>folder</b> of plain files. Boards, jobs and the AI all work inside it.
              </p>
            </div>
            <section className="card plain">
              <NewWorkspaceForm />
            </section>
          </>
        )}
      </div>
    </div>
  )
}
