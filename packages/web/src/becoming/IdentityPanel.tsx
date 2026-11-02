import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { useConfirm, useToast } from '../components/Dialog'
import { IconButton } from '../components/IconButton'
import { STAGE_LABEL } from '../helpers/becoming'
import { fileUrl } from '../helpers/urls'
import { useIdentityPatch } from '../hooks/useIdentityPatch'
import { usePanelEscape } from '../hooks/usePanelEscape'
import { IconCross, IconFile } from '../icons'
import type { TodayRow } from '../types/becoming'
import { IdentityDocument } from './IdentityDocument'

/** The identity's page beside the Becoming board. */
export function IdentityPanel({ ws, row, onClose }: { ws: string; row: TodayRow; onClose: () => void }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const patch = useIdentityPatch(ws)
  const { identity } = row
  const path = `Becoming/${identity.file}`
  usePanelEscape(onClose)

  const letGo = async () => {
    const ok = await confirm({
      title: 'Let go of this identity?',
      body: (
        <>
          <b>{identity.statement}</b> and its page <span className="mono-s">{path}</span> are deleted. Its votes stay in
          the log.
        </>
      ),
      confirmLabel: 'Let go',
      destructive: true,
    })
    if (!ok) return
    await api.deleteIdentity(ws, identity.file)
    onClose()
    toast(`Let go of “${identity.statement}”`, 'quiet')
    await qc.invalidateQueries({ queryKey: ['becoming', ws] })
  }

  return (
    <aside className="panel card-panel" aria-label={`Identity: ${identity.statement}`}>
      <div className="panel-h">
        <span className="mono muted trunc">Becoming / {STAGE_LABEL[identity.stage]}</span>
        <span className="grow" />
        <Link to={fileUrl(ws, path)} className="ibtn ibtn-s" aria-label="Open as page" title="Open as page">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M5 11l6-6M6 5h5v5" />
          </svg>
        </Link>
        <IconButton small label="Close (Esc)" onClick={onClose}>
          <IconCross size={14} sw={1.5} />
        </IconButton>
      </div>
      <div className="panel-body">
        <IdentityDocument ws={ws} identity={identity} strip={row.strip} onPatch={(p) => patch(identity.file, p)} />
      </div>
      <div className="row between panel-f">
        <span className="link muted row g6">
          <IconFile size={13} />
          {path}
        </span>
        <Button size="sm" onClick={() => void letGo()}>
          Let go of this identity
        </Button>
      </div>
    </aside>
  )
}
