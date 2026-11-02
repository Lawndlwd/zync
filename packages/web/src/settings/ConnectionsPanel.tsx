import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useConfirm, useToast } from '../components/Dialog'
import { TextButton } from '../components/TextButton'
import { PROVIDER_NAMES } from '../helpers/connections'
import { errorMessage } from '../helpers/format'
import { wsUrl } from '../helpers/urls'
import { useConnections } from '../hooks/useConnections'
import { ConnectionRow } from './ConnectionRow'
import { SlackConnect } from './SlackConnect'
import { TelegramConnect } from './TelegramConnect'

/**
 * Outside accounts zync reads (never writes): Google (Gmail + Calendar, several accounts), Slack,
 * Telegram. The daily brief and the calendar use them; the secrets stay on the server.
 */
export function ConnectionsPanel({ ws }: { ws: string }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const list = useConnections()
  const [params, setParams] = useSearchParams()
  const [adding, setAdding] = useState<'slack' | 'telegram' | null>(null)
  const [busy, setBusy] = useState(false)

  // Google's consent screen comes back to this page with the outcome in the URL.
  const connected = params.get('connected')
  const connectError = params.get('connectError')
  const dismiss = () =>
    setParams(
      (p) => {
        p.delete('connected')
        p.delete('connectError')
        return p
      },
      { replace: true },
    )

  const refresh = () => qc.invalidateQueries({ queryKey: ['connections'] })

  const connectGoogle = async () => {
    setBusy(true)
    try {
      const { url } = await api.googleConnectUrl(wsUrl(ws, 'settings'))
      window.location.assign(url)
    } catch (err) {
      toast(errorMessage(err), 'bad')
      setBusy(false)
    }
  }

  const available = list.data?.available
  const connections = list.data?.connections ?? []
  return (
    <Card title="Connections" meta="Read-only · Gmail · Calendar · Slack · Telegram">
      <div className="col g12">
        {(connected || connectError) && (
          <div className={`lr hl${connectError ? ' danger-t' : ''}`}>
            <span className="grow">{connectError ? `Google: ${connectError}` : 'Google account connected.'}</span>
            <TextButton onClick={dismiss}>[OK]</TextButton>
          </div>
        )}
        {list.error ? (
          <span className="help err">{errorMessage(list.error)}</span>
        ) : connections.length === 0 ? (
          <span className="small muted">
            Nothing connected yet. Connected accounts feed the daily brief and show in the calendar; zync only reads
            them.
          </span>
        ) : (
          <div className="col">
            {connections.map((c) => (
              <ConnectionRow
                key={c.id}
                connection={c}
                onRename={(label) =>
                  void api
                    .renameConnection(c.id, label)
                    .then(refresh, (err: unknown) => toast(errorMessage(err), 'bad'))
                }
                onReconnect={c.provider === 'google' ? () => void connectGoogle() : undefined}
                onRemove={async () => {
                  const ok = await confirm({
                    title: `Disconnect “${c.label}”?`,
                    body: `zync forgets its ${PROVIDER_NAMES[c.provider]} access. The daily brief stops reading it.`,
                    confirmLabel: 'Disconnect',
                    destructive: true,
                  })
                  if (!ok) return
                  await api.removeConnection(c.id).catch((err: unknown) => toast(errorMessage(err), 'bad'))
                  await refresh()
                }}
              />
            ))}
          </div>
        )}

        {adding === 'slack' ? (
          <SlackConnect
            onCancel={() => setAdding(null)}
            onDone={() => {
              setAdding(null)
              toast('Slack connected')
              void refresh()
            }}
          />
        ) : adding === 'telegram' ? (
          <TelegramConnect
            onCancel={() => setAdding(null)}
            onDone={() => {
              setAdding(null)
              toast('Telegram connected')
              void refresh()
            }}
          />
        ) : (
          <div className="row g8 wrap">
            <Button
              size="sm"
              busy={busy}
              disabled={available?.google === false}
              title={
                available?.google === false ? 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server' : undefined
              }
              onClick={() => void connectGoogle()}
            >
              + Google account
            </Button>
            <Button size="sm" onClick={() => setAdding('slack')}>
              + Slack
            </Button>
            <Button size="sm" onClick={() => setAdding('telegram')}>
              + Telegram
            </Button>
          </div>
        )}
        {available?.google === false && !adding && (
          <span className="help">
            Google needs an OAuth client on the server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, see the README).
          </span>
        )}
      </div>
    </Card>
  )
}
