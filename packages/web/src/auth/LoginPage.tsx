import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'

import { api } from '../api'
import { RecoveryCodes } from '../components/RecoveryCodes'
import { safeNext } from '../helpers/auth'
import { PasskeySignIn } from './PasskeySignIn'
import { SetupForm } from './SetupForm'

/** The only page reachable without a session: sign in, or set up the first passkey. */
export function LoginPage() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const status = useQuery({ queryKey: ['auth', 'status'], queryFn: api.authStatus, retry: false })
  const [codes, setCodes] = useState<string[] | null>(null)
  // After signing in: a full load, so nothing fetched while signed out lingers.
  const enter = () => window.location.replace(next)

  let body
  if (codes) body = <RecoveryCodes codes={codes} onDone={enter} />
  else if (status.isLoading) body = <div className="skel" style={{ height: 44 }} />
  else if (status.error) body = <p className="lede danger-t">{status.error.message}</p>
  else if (status.data?.authenticated) return <Navigate to={next} replace />
  else if (status.data?.setupRequired) body = <SetupForm onDone={setCodes} />
  else body = <PasskeySignIn onSignedIn={enter} />

  return (
    <div className="z app-root welcome">
      <div className="welcome-in col g24" style={{ width: 'min(440px, 100%)' }}>
        <div className="wordmark">
          <i />
          ZYNC
        </div>
        <div className="col g8">
          <h1 className="display">
            {codes ? 'Save your recovery codes' : status.data?.setupRequired ? 'Set up zync' : 'Sign in'}
          </h1>
          <p className="lede">Private workspace. Passkeys only — nothing to guess, nothing to phish.</p>
        </div>
        <section className="card plain">{body}</section>
      </div>
    </div>
  )
}
