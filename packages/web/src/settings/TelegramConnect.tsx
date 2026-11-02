import { useState } from 'react'

import { api } from '../api'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { TextInput } from '../components/TextInput'
import { errorMessage } from '../helpers/format'

type Step = { kind: 'account' } | { kind: 'code'; login: string } | { kind: 'password'; login: string }

/**
 * Telegram's own login, as your account: api_id + api_hash (my.telegram.org), phone number, the
 * code Telegram sends to the app, then the 2FA password when there is one.
 */
export function TelegramConnect({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<Step>({ kind: 'account' })
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phone, setPhone] = useState('')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    action()
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setBusy(false))
  }

  const submit = () => {
    switch (step.kind) {
      case 'account':
        run(async () => {
          const { login } = await api.telegramStart(apiId, apiHash, phone)
          setStep({ kind: 'code', login })
        })
        break
      case 'code':
        run(async () => {
          const r = await api.telegramCode(step.login, secret)
          setSecret('')
          if (r.password) setStep({ kind: 'password', login: step.login })
          else onDone()
        })
        break
      case 'password':
        run(async () => {
          await api.telegramPassword(step.login, secret)
          onDone()
        })
        break
    }
  }

  return (
    <form
      className="col g10 connect-form"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {step.kind === 'account' ? (
        <>
          <span className="help">
            my.telegram.org → API development tools → create an app (any name) to get its api_id and api_hash.
          </span>
          <div className="row g10 wrap">
            <Field label="api_id" style={{ flex: '1 1 120px' }}>
              <TextInput
                compact
                mono
                autoFocus
                inputMode="numeric"
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
              />
            </Field>
            <Field label="api_hash" style={{ flex: '2 1 220px' }}>
              <TextInput compact mono autoComplete="off" value={apiHash} onChange={(e) => setApiHash(e.target.value)} />
            </Field>
          </div>
          <Field label="Phone number" help="International form. Telegram sends a login code to your app.">
            <TextInput
              compact
              type="tel"
              placeholder="+33 6 12 34 56 78"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
        </>
      ) : (
        <Field
          label={step.kind === 'code' ? 'Login code' : 'Two-step verification password'}
          help={
            step.kind === 'code'
              ? 'Sent to your Telegram app (the “Telegram” chat).'
              : 'Your account has a cloud password: Telegram asks for it after the code.'
          }
        >
          <TextInput
            key={step.kind}
            compact
            mono={step.kind === 'code'}
            autoFocus
            type={step.kind === 'password' ? 'password' : 'text'}
            inputMode={step.kind === 'code' ? 'numeric' : undefined}
            autoComplete={step.kind === 'code' ? 'one-time-code' : 'current-password'}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </Field>
      )}
      {error && <span className="help err">{error}</span>}
      <div className="row g8">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          busy={busy}
          disabled={step.kind === 'account' ? !apiId.trim() || !apiHash.trim() || !phone.trim() : !secret}
        >
          {step.kind === 'account' ? 'Send code' : 'Connect Telegram'}
        </Button>
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
