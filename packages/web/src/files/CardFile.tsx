import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { api } from '../api'
import { CardDocument } from '../boards/CardDocument'
import { ButtonLink } from '../components/ButtonLink'
import { useToast } from '../components/Dialog'
import { SaveStatus } from '../components/SaveStatus'
import { statusOf } from '../helpers/boards'
import { errorMessage } from '../helpers/format'
import { basename } from '../helpers/paths'
import { boardUrl, fileUrl } from '../helpers/urls'
import { usePeople } from '../hooks/usePeople'
import { IconBoard } from '../icons'
import type { Board, CardPatch } from '../types/boards'
import type { SaveState } from '../types/save'
import { PageSkeleton } from './PageSkeleton'
import { PathBar } from './PathBar'
import { TextFile } from './TextFile'

export function CardFile({ ws, path, board }: { ws: string; path: string; board: Board }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const people = usePeople()
  const key = ['board', ws, board.path]
  const { data, error } = useQuery({ queryKey: key, queryFn: () => api.board(ws, board.path) })
  const [state, setState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState('')
  const file = basename(path)
  const card = data?.cards.find((c) => c.file === file)

  const patch = async (p: CardPatch) => {
    setState('saving')
    try {
      const saved = await api.updateCard(ws, board.path, file, p)
      setState('saved')
      setSaveError('')
      await qc.invalidateQueries({ queryKey: key })
      // A new title renames the file.
      if (saved.file !== file) void navigate(fileUrl(ws, `${board.path}/${saved.file}`), { replace: true })
    } catch (err) {
      setState('error')
      const msg = errorMessage(err)
      setSaveError(msg)
      toast(msg, 'bad')
    }
  }

  if (error) return <TextFile ws={ws} path={path} />
  if (!data) return <PageSkeleton ws={ws} path={path} />
  if (!card) return <TextFile ws={ws} path={path} />
  const column = board.columns.find((c) => c.id === statusOf(board, card))

  return (
    <div className="fileview">
      <PathBar ws={ws} path={path} status={<SaveStatus state={state} error={saveError} />} />
      <div className="page file-page">
        <div className="doc col g20">
          <div className="card-banner row g12">
            <IconBoard size={16} />
            <span className="grow small">
              This page is a card on board <b style={{ fontWeight: 600 }}>{board.name}</b> · column {column?.name}
              {card.assignee && (
                <>
                  {' '}
                  · assigned to <b style={{ fontWeight: 600 }}>@{card.assignee}</b>
                </>
              )}
            </span>
            <ButtonLink variant="primary" size="sm" to={`${boardUrl(ws, board.path)}?card=${encodeURIComponent(file)}`}>
              [↗] Open board
            </ButtonLink>
          </div>
          <CardDocument
            ws={ws}
            board={board}
            cards={data.cards}
            people={people}
            card={card}
            onPatch={patch}
            onRun={async () => {
              try {
                await api.runCard(ws, board.path, file)
                toast(`${card.title} · queued`)
              } catch (err) {
                toast(errorMessage(err), 'bad')
              }
              await qc.invalidateQueries({ queryKey: key })
            }}
            layout="page"
          />
        </div>
      </div>
    </div>
  )
}
