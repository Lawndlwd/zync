import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { api } from '../api'
import { CardPanel } from '../boards/CardPanel'
import { useConfirm, useToast } from '../components/Dialog'
import { errorMessage } from '../helpers/format'
import type { CardPatch } from '../types/boards'
import type { PanelProps } from '../types/calendar'
import { PanelShell } from './PanelShell'

export function CardSide({
  ws,
  board: boardPath,
  file,
  people,
  onSelect,
  onChanged,
  onClose,
}: PanelProps & { board: string; file: string }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const key = ['board', ws, boardPath]
  const { data, error } = useQuery({ queryKey: key, queryFn: () => api.board(ws, boardPath) })
  const [err, setErr] = useState('')
  const card = data?.cards.find((c) => c.file === file)

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setErr('')
      await fn()
    } catch (caught) {
      const msg = errorMessage(caught)
      setErr(msg)
      toast(msg, 'bad')
    } finally {
      await qc.invalidateQueries({ queryKey: key })
      onChanged()
    }
  }

  if (error || (data && !card))
    return (
      <PanelShell label="Card" crumb={boardPath} onClose={onClose} footer={null}>
        <p className="small muted">{error ? error.message : 'This card no longer exists.'}</p>
      </PanelShell>
    )
  if (!data || !card)
    return (
      <PanelShell label="Card" crumb={boardPath} onClose={onClose} footer={null}>
        <div className="skel" style={{ height: 200 }} />
      </PanelShell>
    )

  return (
    <CardPanel
      ws={ws}
      board={data.board}
      cards={data.cards}
      people={people}
      card={card}
      onPatch={(patch: CardPatch) =>
        run(async () => {
          const saved = await api.updateCard(ws, boardPath, file, patch)
          if (saved.file !== file) onSelect({ type: 'card', board: boardPath, file: saved.file })
        })
      }
      onCreate={async () => {}}
      onRun={() => run(() => api.runCard(ws, boardPath, file))}
      onDelete={async () => {
        const ok = await confirm({
          title: 'Delete card?',
          body: (
            <>
              <b>{card.title}</b> and its file <span className="mono-s">{card.file}</span> are deleted.
            </>
          ),
          confirmLabel: 'Delete card',
          destructive: true,
        })
        if (!ok) return
        await run(async () => {
          await api.deleteCard(ws, boardPath, file)
          onClose()
          toast(`Deleted “${card.title}”`, 'quiet')
        })
      }}
      onClose={onClose}
      error={err}
    />
  )
}
