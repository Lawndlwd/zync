import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { api, ApiError } from '../api'
import { Button } from '../components/Button'
import { useToast } from '../components/Dialog'
import { hoursLabel, identityName, isoWeekOf, shiftWeek, weekLabel } from '../helpers/becoming'
import { ymd } from '../helpers/dates'
import { capitalize, errorMessage } from '../helpers/format'
import { useBecomingWeek } from '../hooks/useBecomingWeek'
import { useMirror } from '../hooks/useMirror'
import { useNow } from '../hooks/useNow'
import { DeclaredLived } from './DeclaredLived'
import { MirrorFacts } from './MirrorFacts'
import { MirrorQuestionCard } from './MirrorQuestionCard'
import { OneChange } from './OneChange'

/** Enough days for the Mirror to say anything. */
const ENOUGH_DAYS = 5

/** "Who you actually were": the week's Mirror, or what Zync saw so far when it isn't written yet. */
export function MirrorView({
  ws,
  week,
  onWeek,
}: {
  ws: string
  week?: string | undefined
  onWeek: (week: string) => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const now = useNow(60_000)
  const current = isoWeekOf(ymd(now))
  const shown = week ?? current
  const mirror = useMirror(ws, shown)
  const live = useBecomingWeek(ws, shown, mirror.data === null)
  const [busy, setBusy] = useState(false)
  const stats = mirror.data?.stats ?? live.data
  const refresh = () => qc.invalidateQueries({ queryKey: ['becoming', ws] })

  const setUp = async () => {
    setBusy(true)
    try {
      await api.enableMirrorJob(ws)
      toast('The Mirror is written every Sunday at 20:00 — change it on the Jobs page.')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) toast(err.message, 'quiet')
      else toast(errorMessage(err), 'bad')
    } finally {
      setBusy(false)
    }
  }
  const apply = async () => {
    setBusy(true)
    try {
      await api.applyMirrorChange(ws, shown)
      toast('Applied — it shows on the identity page and the calendar.')
    } catch (err) {
      toast(errorMessage(err), 'bad')
    } finally {
      setBusy(false)
      await refresh()
    }
  }
  const answer = async (i: number, text: string) => {
    try {
      await api.answerMirror(ws, shown, i, text)
    } catch (err) {
      toast(errorMessage(err), 'bad')
    }
    await refresh()
  }

  const thin = stats !== undefined && stats.daysTracked < ENOUGH_DAYS
  const answered = mirror.data?.questions.filter((q) => q.answer !== undefined).length ?? 0
  const whoOf = (file?: string) => stats?.identities.find((i) => i.file === file)?.statement

  return (
    <div className="col g32" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
      <div className="col g16">
        <div className="row between wrap g8">
          <span className="mono muted">Mirror · {weekLabel(shown)}</span>
          <div className="row g6">
            <Button size="sm" onClick={() => onWeek(shiftWeek(shown, -1))}>
              ‹ W{Number(shiftWeek(shown, -1).slice(-2))}
            </Button>
            <span className="pill on">W{Number(shown.slice(-2))}</span>
            <Button size="sm" disabled={shown >= current} onClick={() => onWeek(shiftWeek(shown, 1))}>
              W{Number(shiftWeek(shown, 1).slice(-2))} ›
            </Button>
          </div>
        </div>
        <h1 className="display">Who you actually were</h1>
        <p className="lede">
          Not a score. What Zync saw across your calendar, files and cards — next to what you said you’d be.
          {stats && stats.trackedMinutes > 0 && <b> {hoursLabel(stats.trackedMinutes)} tracked.</b>}
        </p>
      </div>

      {(mirror.isLoading || (mirror.data === null && live.isLoading)) && (
        <div className="skel" style={{ height: 260 }} />
      )}
      {mirror.error && <p className="lede danger-t">{mirror.error.message}</p>}

      {stats && stats.identities.length === 0 && (
        <p className="lede muted">No identities yet: the Mirror starts once you have one on the board.</p>
      )}

      {stats && stats.identities.length > 0 && (
        <>
          {thin && (
            <section className="card" style={{ gap: 12 }}>
              <h3 className="h2" style={{ fontSize: 24 }}>
                Not enough evidence yet — {stats.daysTracked} day{stats.daysTracked === 1 ? '' : 's'} tracked.
              </h3>
              <p className="small muted" style={{ margin: 0 }}>
                The Mirror is written on Sunday once Zync has seen {ENOUGH_DAYS} days. Nothing to judge from{' '}
                {stats.daysTracked} — here’s only what it saw.
              </p>
            </section>
          )}
          <DeclaredLived stats={stats} />
          {mirror.data && <MirrorFacts ws={ws} facts={mirror.data.facts} identities={stats.identities} />}
          {mirror.data && mirror.data.questions.length > 0 && (
            <section className="col g12" aria-label="Questions from this week">
              <div className="card-h" style={{ borderColor: 'var(--ink)', marginBottom: 4 }}>
                <span className="t">
                  {mirror.data.questions.length === 3 ? 'Three questions' : 'Questions'} from this week
                </span>
                <span className="m">
                  Answer inline · {answered} of {mirror.data.questions.length}
                </span>
              </div>
              {mirror.data.questions.map((q, i) => (
                <MirrorQuestionCard key={q.q} q={q} n={i} who={whoOf(q.identity)} onAnswer={(a) => answer(i, a)} />
              ))}
            </section>
          )}
          {mirror.data?.change && (
            <OneChange
              change={mirror.data.change}
              next={`W${Number(shiftWeek(shown, 1).slice(-2))}`}
              busy={busy}
              onApply={() => void apply()}
            />
          )}
          {mirror.data === null && !thin && (
            <section className="card" style={{ gap: 12 }}>
              <span className="h3">The words for this week aren’t written yet.</span>
              <p className="small muted" style={{ margin: 0 }}>
                Every Sunday at 20:00 the AI reads these numbers, writes what they say about{' '}
                {stats.identities
                  .slice(0, 2)
                  .map((i) => capitalize(identityName(i.statement)).toLowerCase())
                  .join(' and ')}
                , asks you three questions and suggests one change.
              </p>
              <div className="row g8">
                <Button variant="primary" size="sm" busy={busy} onClick={() => void setUp()}>
                  Set up the weekly Mirror
                </Button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
