import { useState } from 'react'

import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { TextInput } from '../components/TextInput'
import { passkeyError } from '../helpers/auth'
import { registerFirstPasskey } from './passkeys'

/** First visit: the setup code from the server log, then this device's passkey. */
export function SetupForm({ onDone }: { onDone: (recoveryCodes: string[]) => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="col g16"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setErr('')
        try {
          onDone(await registerFirstPasskey(code, name.trim()))
        } catch (caught) {
          setErr(passkeyError(caught))
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="small" style={{ margin: 0 }}>
        zync has no passkey yet. The server printed a one-time <b>setup code</b> in its log when it started (valid one
        hour; restart it for a new one). Only someone who can read that log can claim this zync.
      </p>
      <Field label="Setup code" error={err}>
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
      <Field label="Name this passkey" help="So you can tell your devices apart later.">
        <TextInput placeholder="e.g. MacBook" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" busy={busy} disabled={!code.trim()}>
        Create passkey
      </Button>
    </form>
  )
}
