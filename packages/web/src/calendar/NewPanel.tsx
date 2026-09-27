import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { api } from '../api'
import { CardPanel } from '../boards/CardPanel'
import { useToast } from '../components/Dialog'
import { Segmented } from '../components/Segmented'
import { Select } from '../components/Select'
import { firstColumn } from '../helpers/boards'
import { errorMessage } from '../helpers/format'
import type { Board, Draft } from '../types/boards'
import type { NewKind, PanelProps } from '../types/calendar'
import { dayOf, DEFAULT_MINUTES, minutesBetween } from './helpers'
import { NewEvent } from './NewEvent'

export function NewPanel({
  ws,
  start,
  end,
  people,
  onSelect,
  onChanged,
  onClose,
}: PanelProps & { start: string; end: string }) {
  const toast = useToast()
  const [kind, setKind] = useState<NewKind>('event')
  const { data: boards = [] } = useQuery({ queryKey: ['boards', ws], queryFn: () => api.boards(ws) })
  const [boardPath, setBoardPath] = useState<string>('')
  const board: Board | undefined = boards.find((b) => b.path === boardPath) ?? boards[0]

  const switcher = (
    <div className="row between g8 cal-new-switch">
      <Segmented<NewKind>
        label="Create"
        value={kind}
        options={[
          { value: 'event', label: 'Event' },
          { value: 'card', label: 'Card' },
        ]}
        onChange={setKind}
      />
      {kind === 'card' && boards.length > 0 && (
        <div style={{ minWidth: 160 }}>
          <Select
            compact
            ariaLabel="Board"
            value={board?.path}
            options={boards.map((b) => ({ value: b.path, label: b.name, text: b.path }))}
            onChange={setBoardPath}
          />
        </div>
      )}
    </div>
  )

  if (kind === 'card' && board) {
    const timed = start.length > 10
    const minutes = timed ? minutesBetween(start, end) : DEFAULT_MINUTES
    const draft: Draft = {
      title: '',
      status: firstColumn(board),
      due: timed ? start : dayOf(start),
      duration: timed && minutes !== DEFAULT_MINUTES ? minutes : undefined,
      labels: [],
      description: '',
      context: [],
    }
    return (
      <CardPanel
        key={board.path}
        ws={ws}
        board={board}
        cards={[]}
        people={people}
        draft={draft}
        top={switcher}
        onPatch={async () => {}}
        onCreate={async (d) => {
          try {
            const c = await api.createCard(ws, board.path, {
              title: d.title,
              status: d.status,
              assignee: d.assignee || undefined,
              due: d.due || undefined,
              duration: d.due?.includes('T') ? d.duration : undefined,
              labels: d.labels,
              description: d.description || undefined,
              runAt: d.assignee === 'ai' ? d.runAt || undefined : undefined,
              context: d.assignee === 'ai' ? d.context : undefined,
            })
            onChanged()
            onSelect({ type: 'card', board: board.path, file: c.file })
            toast(`Created “${c.title}”`)
          } catch (err) {
            toast(errorMessage(err), 'bad')
          }
        }}
        onRun={async () => {}}
        onDelete={() => {}}
        onClose={onClose}
        error=""
        createLabel="Create card"
      />
    )
  }

  return (
    <NewEvent
      ws={ws}
      start={start}
      end={end}
      people={people}
      top={switcher}
      noBoards={kind === 'card' && !boards.length}
      onCreated={(file) => {
        onChanged()
        onSelect({ type: 'event', file })
      }}
      onClose={onClose}
    />
  )
}
