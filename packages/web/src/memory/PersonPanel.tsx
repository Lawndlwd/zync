import { useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../api'
import { IconButton } from '../components/IconButton'
import { PersonAvatar } from '../components/PersonAvatar'
import { usePanelEscape } from '../hooks/usePanelEscape'
import { IconCross, IconSpark } from '../icons'
import type { Person } from '../types/people'
import { LiveMarkdown } from './LiveMarkdown'

const HINT: Record<string, string> = {
  me: 'Who you are, what you work on, how you like answers, your routines. The AI reads this in every chat.',
  ai: 'How the AI should work for you: tone, language, what to always or never do. Read in every chat.',
}

/**
 * What the AI knows about a person, as a page (`.zync/people/<id>.md`). You write it, and the AI adds
 * to it as it learns (person_note). Every chat gets these notes in its prompt.
 */
export function PersonPanel({
  ws,
  person,
  people,
  onClose,
}: {
  ws: string
  person: Person
  people: Person[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const key = ['person-notes', person.id]
  // No file events outside the workspace: poll, so notes the AI writes show up while you look.
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.personNotes(person.id),
    refetchInterval: 4000,
  })

  usePanelEscape(onClose)

  return (
    <aside className="panel card-panel" aria-label={`Notes about ${person.name}`}>
      <div className="panel-h">
        <span className="mono muted trunc">People / {person.name}</span>
        <span className="grow" />
        <IconButton small label="Close (Esc)" onClick={onClose}>
          <IconCross size={14} sw={1.5} />
        </IconButton>
      </div>
      <div className="panel-body">
        <div className="doc card-doc in-panel col g20">
          <div className="row g12">
            <PersonAvatar id={person.id} people={people} size="xl" />
            <div className="col g4">
              <span className="h2">{person.name}</span>
              <span className="mono-s muted">
                @{person.id} · .zync/people/{person.id}.md
              </span>
            </div>
          </div>
          <section className="aibox ai-strip" aria-label="How the AI uses this">
            <span className="small row g8" style={{ alignItems: 'flex-start' }}>
              <IconSpark size={13} />
              <span>
                {HINT[person.id] ??
                  `Who ${person.name} is, their role, how to work with them. The AI reads this in every chat and adds what it learns.`}
              </span>
            </span>
          </section>
          {isLoading ? (
            <div className="skel" style={{ height: 160 }} />
          ) : (
            <LiveMarkdown
              docKey={person.id}
              ws={ws}
              value={data?.notes ?? ''}
              onSave={async (notes) => {
                const saved = await api.savePersonNotes(person.id, notes)
                qc.setQueryData(key, saved)
              }}
            />
          )}
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>
            Type <span className="kbd">/</span> for blocks · changes save automatically
          </p>
        </div>
      </div>
    </aside>
  )
}
