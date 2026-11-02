import { useState } from 'react'
import { Link } from 'react-router'

import { Button } from '../components/Button'
import { shortDate } from '../helpers/becoming'
import { ymd } from '../helpers/dates'
import { plural } from '../helpers/format'
import { minutesLabel, monthLabel, monthOf, shiftMonth, volumeLabel } from '../helpers/training'
import { trainingUrl } from '../helpers/urls'
import { useNow } from '../hooks/useNow'
import { useWorkouts } from '../hooks/useWorkouts'
import type { Units } from '../types/training'
import { LogCalendar } from './LogCalendar'

/** Every workout, month by month: a calendar of the days trained and one line per session. */
export function LogTab({ ws, units, openFile }: { ws: string; units: Units; openFile: string }) {
  const thisMonth = monthOf(ymd(useNow(60_000)))
  const [month, setMonth] = useState(thisMonth)
  const { data, error, isLoading } = useWorkouts(ws, month)
  const list = (data ?? []).toSorted((a, b) => b.date.localeCompare(a.date))
  const openUrl = (file: string) => `${trainingUrl(ws, 'log')}?open=${encodeURIComponent(file)}`
  const volume = list.reduce((n, w) => n + w.volumeKg, 0)

  return (
    <div className="tr-log">
      <div className="col g12">
        <div className="row g8">
          <Button size="sm" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
            [←]
          </Button>
          <span className="h3 grow" style={{ textAlign: 'center' }}>
            {monthLabel(month)}
          </span>
          <Button
            size="sm"
            aria-label="Next month"
            disabled={month >= thisMonth}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            [→]
          </Button>
        </div>
        <LogCalendar month={month} workouts={list} openFile={openFile} linkTo={openUrl} />
        <span className="mono-s muted">
          {plural(list.length, 'workout')} · {volumeLabel(volume, units)}
        </span>
      </div>

      <div className="col">
        {error && <p className="lede danger-t">{error.message}</p>}
        {isLoading && <div className="skel" style={{ height: 240 }} />}
        {data && list.length === 0 && <p className="small muted">No workouts logged in {monthLabel(month)}.</p>}
        {list.map((w) => (
          <Link key={w.file} to={openUrl(w.file)} className={`lr row-link${w.file === openFile ? ' hl' : ''}`}>
            <span className="mono-s muted" style={{ width: 64, flexShrink: 0 }}>
              {shortDate(w.date)}
            </span>
            <span className="grow col g4" style={{ minWidth: 0 }}>
              <span className="trunc">{w.name}</span>
              <span className="mono-s muted trunc">
                {w.active ? 'in progress' : minutesLabel(w.durationMin)} · {plural(w.sets, 'set')} ·{' '}
                {volumeLabel(w.volumeKg, units)}
                {w.muscles.length > 0 ? ` · ${w.muscles.join(', ')}` : ''}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
