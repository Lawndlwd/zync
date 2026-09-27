import { useState } from 'react'

import { Button } from '../components/Button'
import { TextButton } from '../components/TextButton'
import { passkeyError } from '../helpers/auth'
import { signInWithPasskey } from './passkeys'
import { RecoveryForm } from './RecoveryForm'

/** Sign in with a passkey, or with a recovery code as the way back when none is at hand. */
export function PasskeySignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [recovery, setRecovery] = useState(false)
  if (recovery)
    return (
      <div className="col g12">
        <RecoveryForm onSignedIn={onSignedIn} />
        <TextButton className="muted" onClick={() => setRecovery(false)}>
          [← Use a passkey]
        </TextButton>
      </div>
    )
  return (
    <div className="col g12">
      <Button
        variant="primary"
        size="lg"
        busy={busy}
        autoFocus
        onClick={async () => {
          setBusy(true)
          setErr('')
          try {
            await signInWithPasskey()
            onSignedIn()
          } catch (caught) {
            setErr(passkeyError(caught))
          } finally {
            setBusy(false)
          }
        }}
      >
        Sign in with passkey
      </Button>
      {err && (
        <span className="small danger-t" role="alert">
          {err}
        </span>
      )}
      <TextButton className="muted" onClick={() => setRecovery(true)}>
        [Use a recovery code]
      </TextButton>
    </div>
  )
}
