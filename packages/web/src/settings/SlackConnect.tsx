import { useState } from 'react'

import { api } from '../api'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { TextInput } from '../components/TextInput'
import { errorMessage } from '../helpers/format'

/** Paste a Slack user token (README → Connections lists the scopes to give the app). */
export function SlackConnect({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [token, setToken] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <form
      className="col g10 connect-form"
      onSubmit={(e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        api
          .connectSlack(token, label.trim() || undefined)
          .then(onDone, (err: unknown) => setError(errorMessage(err)))
          .finally(() => setBusy(false))
      }}
    >
      <Field
        label="User OAuth token"
        error={error}
        help="api.slack.com/apps → your app → OAuth & Permissions → User OAuth Token (xoxp-…). Read-only scopes: im:read, im:history, mpim:read, mpim:history, search:read, users:read."
      >
        <TextInput
          compact
          mono
          autoFocus
          type="password"
          autoComplete="off"
          placeholder="xoxp-…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </Field>
      <Field label="Name (optional)">
        <TextInput
          compact
          placeholder="e.g. Acme"
          value={label}
          maxLength={40}
          onChange={(e) => setLabel(e.target.value)}
        />
      </Field>
      <div className="row g8">
        <Button type="submit" variant="primary" size="sm" busy={busy} disabled={!token.trim()}>
          Connect Slack
        </Button>
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
