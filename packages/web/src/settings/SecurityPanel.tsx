import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { api } from '../api'
import { registerPasskey, withPasskeyCheck } from '../auth/passkeys'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useConfirm, useToast } from '../components/Dialog'
import { RecoveryCodes } from '../components/RecoveryCodes'
import { TextInput } from '../components/TextInput'
import { passkeyError } from '../helpers/auth'
import { PasskeyRow } from './PasskeyRow'
import { SessionRow } from './SessionRow'

/**
 * Who can get in: passkeys (add one per device, remove lost ones), signed-in browsers, recovery
 * codes. Changing passkeys or codes asks for a passkey again when the last check is old.
 */
export function SecurityPanel() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const passkeys = useQuery({ queryKey: ['auth', 'passkeys'], queryFn: api.passkeys })
  const sessions = useQuery({ queryKey: ['auth', 'sessions'], queryFn: api.authSessions })
  const status = useQuery({ queryKey: ['auth', 'status'], queryFn: api.authStatus })
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [codes, setCodes] = useState<string[] | null>(null)

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true)
    try {
      await action()
      if (done) toast(done)
    } catch (err) {
      toast(passkeyError(err), 'bad')
    } finally {
      setBusy(false)
      await qc.invalidateQueries({ queryKey: ['auth'] })
    }
  }

  if (codes)
    return (
      <Card title="New recovery codes" meta="Shown once">
        <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />
      </Card>
    )

  const left = status.data?.recoveryCodesLeft
  return (
    <Card title="Security" meta="Passkeys · sessions · recovery">
      <div className="col g16">
        <div className="col">
          <span className="flabel">Passkeys</span>
          {passkeys.data?.map((p) => (
            <PasskeyRow
              key={p.id}
              passkey={p}
              onRemove={async () => {
                const ok = await confirm({
                  title: `Remove “${p.name}”?`,
                  body: 'That device will no longer sign in to zync.',
                  confirmLabel: 'Remove passkey',
                  destructive: true,
                })
                if (ok) await run(() => withPasskeyCheck(() => api.removePasskey(p.id)), 'Passkey removed')
              }}
            />
          ))}
          <form
            className="row g8"
            style={{ marginTop: 10 }}
            onSubmit={(e) => {
              e.preventDefault()
              void run(() => withPasskeyCheck(() => registerPasskey(name.trim())), 'Passkey added').then(() =>
                setName(''),
              )
            }}
          >
            <TextInput
              compact
              className="grow"
              placeholder="Name, e.g. iPhone or YubiKey"
              aria-label="New passkey name"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" size="sm" busy={busy}>
              Add passkey
            </Button>
          </form>
          <span className="help">Add one per device (or a security key) so losing one never locks you out.</span>
        </div>

        <div className="col">
          <span className="flabel">Signed-in browsers</span>
          {sessions.data?.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              onRevoke={() =>
                void run(async () => {
                  await api.revokeSession(s.id)
                  if (s.current) window.location.assign('/login')
                }, 'Signed out')
              }
            />
          ))}
        </div>

        <div className="row g8 wrap">
          <Button size="sm" busy={busy} onClick={() => void run(api.revokeOtherSessions, 'Other browsers signed out')}>
            Sign out everywhere else
          </Button>
          <Button
            size="sm"
            busy={busy}
            onClick={() => void run(async () => setCodes((await withPasskeyCheck(api.newRecoveryCodes)).recoveryCodes))}
          >
            New recovery codes{left === undefined ? '' : ` (${left} left)`}
          </Button>
          <span className="grow" />
          <Button
            size="sm"
            variant="danger"
            onClick={() =>
              void api.logout().finally(() => {
                window.location.assign('/login')
              })
            }
          >
            Sign out
          </Button>
        </div>
      </div>
    </Card>
  )
}
