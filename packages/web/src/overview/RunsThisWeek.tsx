import { Card } from '../components/Card'
import { runningCards, upcoming } from '../helpers/boards'
import { addDays, sameDay, startOfWeek } from '../helpers/dates'
import { isFailedRun } from '../helpers/runs'
import type { WorkspaceData } from '../types/workspace'

const MAX_DOTS = 8

export function RunsThisWeek({ data, now }: { data: WorkspaceData; now: Date }) {
  const monday = startOfWeek(now)
  const next = upcoming(data.jobs, data.cards, now)
  const running = runningCards(data.cards).length
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i)
    const runs = data.runs.filter((r) => sameDay(r.time, day))
    const count = (s: string) => runs.filter((r) => r.run.status === s).length
    return {
      day,
      ok: count('ok'),
      fail: count('failed'),
      to: count('timeout'),
      run: sameDay(day, now) ? running : 0,
      plan: next.filter((u) => sameDay(u.time, day)).length,
    }
  })
  const week = data.runs.filter((r) => r.time >= monday)
  const total = week.filter((r) => r.run.status !== 'skipped').length
  const failed = week.filter((r) => isFailedRun(r.run.status)).length
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const aria = days
    .map((d, i) => {
      const parts = [
        d.ok && `${d.ok} ok`,
        d.fail && `${d.fail} failed`,
        d.to && `${d.to} timed out`,
        d.run && `${d.run} running`,
        d.plan && `${d.plan} planned`,
      ].filter(Boolean)
      return `${names[i]} ${parts.join(' ') || 'none'}`
    })
    .join('; ')

  return (
    <Card title="AI runs this week" meta={`${total} runs · ${failed} failed`} className="c-dots">
      <div className="dots" role="img" aria-label={`Runs per day: ${aria}`}>
        {days.map((d) => {
          const dots = [
            ...Array(d.ok).fill('ok'),
            ...Array(d.to).fill('to'),
            ...Array(d.fail).fill('fail'),
            ...Array(d.run).fill('ok pulse'),
            ...Array(d.plan).fill('plan'),
          ].slice(0, MAX_DOTS)
          return (
            <div key={d.day.getTime()} className="dcol">
              {dots.map((c, i) => (
                // oxlint-disable-next-line react/no-array-index-key -- dots are positional and never reorder
                <i key={i} className={`dd ${c}`} />
              ))}
            </div>
          )
        })}
      </div>
      <div className="xlab mono-s muted" style={{ marginTop: 8 }}>
        {letters.map((l, i) => (
          <span key={names[i]} style={days[i] && sameDay(days[i].day, now) ? { color: 'var(--ink)' } : undefined}>
            {l}
          </span>
        ))}
      </div>
      <div className="row g12 wrap mono-s muted" style={{ marginTop: 14 }}>
        <span className="row g4">
          <i className="dd ok" style={{ width: 10, height: 10 }} />
          OK
        </span>
        <span className="row g4">
          <i className="dd fail" style={{ width: 10, height: 10 }} />
          Failed
        </span>
        <span className="row g4">
          <i className="dd to" style={{ width: 10, height: 10 }} />
          Timeout
        </span>
        <span className="row g4">
          <i className="dd plan" style={{ width: 10, height: 10 }} />
          Planned
        </span>
      </div>
    </Card>
  )
}
