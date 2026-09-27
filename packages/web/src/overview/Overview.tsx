import { useNavigate } from 'react-router'

import { Chip } from '../components/Chip'
import { dueThisWeek, reviewCards } from '../helpers/boards'
import { dateTimeLabel, sameDay, startOfDay, startOfWeek } from '../helpers/dates'
import { isTyping } from '../helpers/dom'
import { plural } from '../helpers/format'
import { isFailedRun } from '../helpers/runs'
import { boardUrl, wsUrl } from '../helpers/urls'
import { useHotkeys } from '../hooks/useHotkeys'
import { useNow } from '../hooks/useNow'
import { usePref } from '../hooks/usePref'
import { useWorkspaceData } from '../hooks/useWorkspaceData'
import { GettingStarted } from '../onboarding/GettingStarted'
import { useShell } from '../shell/ShellContext'
import type { Range } from '../types/overview'
import { MyCards } from './MyCards'
import { QuickAccess } from './QuickAccess'
import { RangeButton } from './RangeButton'
import { ReadyForReview } from './ReadyForReview'
import { RecentlyEdited } from './RecentlyEdited'
import { RunResults } from './RunResults'
import { RunsThisWeek } from './RunsThisWeek'
import { Schedule } from './Schedule'
import { Workload } from './Workload'

export function Overview() {
  const shell = useShell()
  const { ws } = shell
  const navigate = useNavigate()
  const data = useWorkspaceData(ws)
  // Re-render every 30 s so clocks and "in 2h 48m" stay current.
  const now = useNow(30_000)
  const [range, setRange] = usePref<Range>('zync:overviewRange', 'today')
  const me = data.people.find((p) => p.id === 'me')
  const name = me && me.name !== 'Me' ? me.name : ''

  const from = range === 'today' ? startOfDay(now) : startOfWeek(now)
  const inRange = data.runs.filter((r) => r.time >= from)
  const today = data.runs.filter((r) => sameDay(r.time, now))
  const finished = today.filter((r) => r.run.status === 'ok').length
  const needs = today.filter((r) => isFailedRun(r.run.status)).length
  const review = reviewCards(data.cards)
  const due = dueThisWeek(data.cards, now)
  const failedInRange = inRange.filter((r) => isFailedRun(r.run.status)).length
  const firstBoard = data.boards[0]

  const quick = {
    newPage: () => shell.startCreate({ dir: '', kind: 'page' }),
    newCard: () => navigate(firstBoard ? boardUrl(ws, firstBoard.path) : wsUrl(ws, 'boards')),
    schedule: () => navigate(wsUrl(ws, 'jobs')),
    ask: () => shell.dock === 'rail' && shell.toggleDock(),
    boards: () => navigate(wsUrl(ws, 'boards')),
  }

  // Quick-access single-key shortcuts (N, C, S, B) while nothing is being typed.
  useHotkeys((e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || isTyping(e.target)) return
    if (document.querySelector('.palette-wrap')) return
    const fn = { n: quick.newPage, c: quick.newCard, s: quick.schedule, b: quick.boards }[e.key.toLowerCase()]
    if (fn) {
      e.preventDefault()
      void fn()
    }
  })

  return (
    <div className="page col g24">
      <div className="col g16">
        <div className="row between">
          <span className="mono muted">{ws} / overview</span>
          <span className="mono muted">{dateTimeLabel(now)}</span>
        </div>
        <h1 className="display">Today’s Overview</h1>
        <p className="lede">
          Hello{name ? `, ${name}` : ''}!{' '}
          {finished || needs ? (
            <>
              The AI finished <b>{plural(finished, 'task')}</b> and{' '}
              <b>
                {needs} {needs === 1 ? 'needs' : 'need'} you
              </b>
              .
            </>
          ) : (
            'Nothing from the AI needs you right now.'
          )}
        </p>
        <div className="row g8 wrap" style={{ marginTop: 4 }}>
          <Chip
            n={review.length}
            label="In review"
            to={review[0] ? boardUrl(ws, review[0].board.path) : wsUrl(ws, 'boards')}
          />
          <Chip
            n={failedInRange}
            label={failedInRange === 1 ? 'Failed run' : 'Failed runs'}
            bad={failedInRange > 0}
            to={wsUrl(ws, 'jobs')}
          />
          <Chip
            n={due.length}
            label="Due this week"
            to={due[0] ? boardUrl(ws, due[0].board.path) : wsUrl(ws, 'boards')}
          />
          <RangeButton range={range} setRange={setRange} />
        </div>
      </div>

      <GettingStarted ws={ws} data={data} />

      <div className="ov-grid">
        <QuickAccess quick={quick} />
        <ReadyForReview ws={ws} cards={review} />
        <RunResults ws={ws} data={data} runs={inRange} range={range} />
        <Schedule data={data} now={now} />
        <MyCards ws={ws} data={data} now={now} />
        <RunsThisWeek data={data} now={now} />
        <Workload data={data} now={now} />
        <RecentlyEdited ws={ws} data={data} now={now} />
      </div>
    </div>
  )
}
