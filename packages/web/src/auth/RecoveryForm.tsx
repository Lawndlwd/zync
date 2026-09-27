import { useState } from 'react'

import { api } from '../api'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { TextInput } from '../components/TextInput'
import { errorMessage } from '../helpers/format'

/** Sign in with a one-time recovery code when no passkey is at hand. */
export function RecoveryForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="col g12"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setErr('')
        try {
          await api.recoverySignIn(code)
          onSignedIn()
        } catch (caught) {
          setErr(errorMessage(caught))
        } finally {
          setBusy(false)
        }
      }}
    >
      <Field label="Recovery code" error={err} help="Each code works once. Add a new passkey once you’re in.">
        <TextInput
          autoFocus
          mono
          autoComplete="one-time-code"
          placeholder="XXXX-XXXX-XXXX-XXXX"
          value={code}
          invalid={!!err}
          onChange={(e) => setCode(e.target.value)}
        />
      </Field>
      <Button type="submit" variant="primary" busy={busy} disabled={!code.trim()}>
        Sign in
      </Button>
    </form>
  )
}
