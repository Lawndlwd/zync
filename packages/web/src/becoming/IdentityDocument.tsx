import { Suspense } from 'react'

import { useToast } from '../components/Dialog'
import { LazyMarkdownEditor } from '../components/LazyMarkdownEditor'
import { Select } from '../components/Select'
import { TagInput } from '../components/TagInput'
import { TextInput } from '../components/TextInput'
import { TitleInput } from '../components/TitleInput'
import {
  guardText,
  MINUTE_OPTIONS,
  parseAll,
  parseGuard,
  parseSignal,
  parseWhen,
  shortDate,
  signalText,
  WORKOUT_SIGNAL,
  STAGE_LABEL,
  STAGES,
  stripCounts,
} from '../helpers/becoming'
import { useDebouncedSave } from '../hooks/useDebouncedSave'
import { useExternalReload } from '../hooks/useExternalReload'
import type { Guard, Identity, IdentityPatch, Signal, StripCell } from '../types/becoming'
import { HeatStrip } from './HeatStrip'
import { ProofList } from './ProofList'

/**
 * An identity is a page (Becoming/<name>.md): the statement as its title, the frontmatter as a
 * property sheet, the why in the page editor, and the proof Zync appends below.
 */
export function IdentityDocument({
  ws,
  identity,
  strip,
  onPatch,
}: {
  ws: string
  identity: Identity
  strip: StripCell[]
  onPatch: (patch: IdentityPatch) => Promise<unknown>
}) {
  const toast = useToast()
  const saver = useDebouncedSave<string>()
  const { version, box, edited, onBlur } = useExternalReload(identity.why, () => saver.busy())
  const counts = stripCounts(strip)
  const firstDay = strip.length ? identity.since : ''

  const text = (field: 'action' | 'small', value: string) => {
    const v = value.trim()
    if (v === (identity[field] ?? '')) return
    if (field === 'small') void onPatch({ small: v || null })
    else if (v) void onPatch({ action: v })
  }

  /** Save chips that all read; otherwise say which one doesn't. */
  const chips = <T,>(values: string[], parse: (t: string) => T | null, hint: string, save: (v: T[]) => void) => {
    const r = parseAll(values, parse)
    if ('bad' in r) toast(`Can’t read “${r.bad}”. Try ${hint}.`, 'bad')
    else save(r.ok)
  }

  return (
    <div className="doc card-doc in-panel col g16">
      <div className="col g8">
        <TitleInput
          key={identity.statement}
          className="doc-title"
          defaultValue={identity.statement}
          aria-label="Identity statement"
          onBlur={(e) => {
            const statement = e.target.value.trim()
            if (statement && statement !== identity.statement) void onPatch({ statement })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <HeatStrip cells={strip} large />
        <div className="row between mono-s muted">
          <span>{firstDay ? shortDate(firstDay) : ''}</span>
          <span>
            {counts.votes} votes · {counts.full} full · {counts.small} small
          </span>
          <span>today</span>
        </div>
      </div>

      <div
        className="kv"
        style={{
          gridTemplateColumns: '84px minmax(0, 1fr)',
          gap: '8px 12px',
          padding: '12px 0',
          borderTop: '1px solid var(--line)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span className="k">action</span>
        <TextInput
          compact
          key={`a:${identity.action}`}
          defaultValue={identity.action}
          aria-label="action"
          onBlur={(e) => text('action', e.target.value)}
        />
        <span className="k">small</span>
        <TextInput
          compact
          key={`s:${identity.small ?? ''}`}
          defaultValue={identity.small ?? ''}
          placeholder="The 2-minute version"
          aria-label="small"
          onBlur={(e) => text('small', e.target.value)}
        />
        <span className="k">when</span>
        <TextInput
          compact
          key={`w:${identity.when ?? ''}`}
          defaultValue={identity.when ?? ''}
          placeholder="morning · midday · evening · 07:30"
          aria-label="when"
          onBlur={(e) => {
            const raw = e.target.value.trim()
            if (raw === (identity.when ?? '')) return
            const when = raw ? parseWhen(raw) : null
            if (raw && !when) toast('When is morning, midday, evening or a time like 07:30.', 'bad')
            else void onPatch({ when })
          }}
        />
        <span className="k">minutes</span>
        <Select
          compact
          ariaLabel="minutes"
          value={String(identity.minutes)}
          options={[...new Set([...MINUTE_OPTIONS, identity.minutes])]
            .toSorted((a, b) => a - b)
            .map((m) => ({ value: String(m), label: `${m} min` }))}
          onChange={(m) => void onPatch({ minutes: Number(m) })}
        />
        <span className="k" style={{ alignSelf: 'start', paddingTop: 4 }}>
          signals
        </span>
        <TagInput
          ariaLabel="signals"
          variant="tag"
          addLabel="+ signal"
          placeholder="files: Writing/ · event: run · card: #essay · workout"
          suggestions={[WORKOUT_SIGNAL]}
          values={identity.signals.map(signalText)}
          onChange={(values) =>
            chips<Signal>(
              values,
              parseSignal,
              '“files: Writing/”, “event: run”, “card: #essay” or “workout”',
              (signals) => {
                void onPatch({ signals })
              },
            )
          }
        />
        <span className="k" style={{ alignSelf: 'start', paddingTop: 4 }}>
          guards
        </span>
        <TagInput
          ariaLabel="guards"
          variant="tag"
          addLabel="+ guard"
          placeholder="Present at home · 19:00–24:00"
          values={identity.guards.map(guardText)}
          onChange={(values) =>
            chips<Guard>(values, parseGuard, '“Present at home · 19:00–24:00 · weekdays”', (guards) => {
              void onPatch({ guards })
            })
          }
        />
        <span className="k">stage</span>
        <Select
          compact
          ariaLabel="stage"
          value={identity.stage}
          options={STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
          onChange={(stage) => void onPatch({ stage })}
        />
      </div>

      <div className="col g6">
        <span className="flabel">Why I want this</span>
        <div ref={box} onBlur={onBlur}>
          <Suspense fallback={<div className="skel" style={{ height: 80 }} />}>
            <LazyMarkdownEditor
              key={`${identity.file}:${version}`}
              ws={ws}
              dir="Becoming"
              value={identity.why}
              onChange={(md) => {
                edited(md)
                saver.schedule(identity.file, md, (why) => onPatch({ why }))
              }}
            />
          </Suspense>
        </div>
      </div>

      <ProofList proof={identity.proof} />
    </div>
  )
}
