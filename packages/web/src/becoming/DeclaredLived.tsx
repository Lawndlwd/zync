import { dayBar, hoursLabel, identityColor, identityName } from '../helpers/becoming'
import { addDays, dayLabel, ymd } from '../helpers/dates'
import { capitalize } from '../helpers/format'
import type { BecomingWeek } from '../types/becoming'

const name = (statement: string) => capitalize(identityName(statement))

/** Who you said you'd be (equal weight) above where the week's hours actually went. */
export function DeclaredLived({ stats }: { stats: BecomingWeek }) {
  const ids = stats.identities
  const lived = ids.filter((i) => i.minutes > 0)
  const withSpans = ids.find((i) => i.spans.length > 0 && !i.kept)
  const guard = ids.find((i) => i.kept)
  const days = Array.from({ length: 7 }, (_, n) => addDays(new Date(`${stats.from}T00:00`), n))
  return (
    <section className="card" aria-label="Declared versus lived">
      <div className="card-h">
        <span className="t">Declared vs lived</span>
        <span className="m">Tracked hours · Mon–Sun</span>
      </div>
      <div className="col g8">
        <span className="flabel">Declared — {ids.length} identities, equal weight</span>
        <div className="sbar" style={{ height: 10 }}>
          {ids.map((i, n) => (
            <i key={i.file} style={{ flex: 1, background: identityColor(n) }} />
          ))}
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, ids.length)}, minmax(0, 1fr))` }}
          className="mono-s muted"
        >
          {ids.map((i) => (
            <span key={i.file} className="trunc">
              {name(i.statement)}
            </span>
          ))}
        </div>
      </div>
      <div className="col g8" style={{ marginTop: 22 }}>
        <span className="flabel">Lived — where the hours went</span>
        <div
          className="sbar"
          style={{ height: 48 }}
          role="img"
          aria-label={[
            ...lived.map((i) => `${name(i.statement)} ${hoursLabel(i.minutes)}`),
            `unclaimed ${hoursLabel(stats.unclaimed.minutes)}`,
          ].join(', ')}
        >
          {ids.map((i, n) =>
            i.minutes > 0 ? (
              <i key={i.file} style={{ flex: i.minutes, background: identityColor(n), minWidth: 6 }} />
            ) : null,
          )}
          {stats.unclaimed.minutes > 0 && <i className="unclaimed" style={{ flex: stats.unclaimed.minutes }} />}
          {stats.trackedMinutes === 0 && (
            <i style={{ flex: 1, border: '1px dashed var(--line)', background: 'transparent' }} />
          )}
        </div>
        <div className="row g24 wrap" style={{ marginTop: 6 }}>
          {ids.map((i, n) => (
            <span key={i.file} className="row g8">
              <i className="sw-id" style={{ background: identityColor(n) }} />
              <span className="mono-s">{name(i.statement)}</span>
              <span className="num-m" style={{ fontSize: 26 }}>
                {i.kept
                  ? `${i.kept.length}/${stats.daysTracked}`
                  : i.minutes
                    ? hoursLabel(i.minutes)
                    : i.cards
                      ? `${i.cards} cards`
                      : '0h'}
              </span>
            </span>
          ))}
          <span className="row g8">
            <i className="sw-id unclaimed" style={{ border: '1px solid var(--line)' }} />
            <span className="mono-s">Unclaimed · meetings</span>
            <span className="num-m" style={{ fontSize: 26 }}>
              {hoursLabel(stats.unclaimed.minutes)}
            </span>
          </span>
        </div>
      </div>
      {(withSpans ?? guard) && (
        <div className="mirror-when">
          {withSpans && (
            <div className="col g8">
              <span className="flabel">When {identityName(withSpans.statement)} happened</span>
              <div className="col g4">
                {withSpans.spans.slice(0, 7).map((s) => {
                  const bar = dayBar(s.start, s.end)
                  return (
                    <div key={`${s.date}${s.start}`} className="row g8">
                      <span className="mono-s muted" style={{ width: 30 }}>
                        {dayLabel(new Date(`${s.date}T00:00`)).slice(0, 3)}
                      </span>
                      <div className="when-track">
                        <i
                          style={{
                            left: `${bar.left}%`,
                            width: `${bar.width}%`,
                            background: identityColor(ids.indexOf(withSpans)),
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
                <div className="row between mono-s muted" style={{ paddingLeft: 38 }}>
                  {['06', '09', '12', '15', '18', '21', '24'].map((h) => (
                    <span key={h}>{h}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {guard?.kept && (
            <div className="col g8">
              <span className="flabel">{capitalize(identityName(guard.statement))} · days kept</span>
              <div className="row g6">
                {days.map((d) => {
                  const day = ymd(d)
                  const kept = guard.kept?.includes(day) ?? false
                  return (
                    <div key={day} className="col g4" style={{ alignItems: 'center' }}>
                      <i className={`kept-day${kept ? ' on' : ''}`} />
                      <span className="mono-s muted">{dayLabel(d).slice(0, 1)}</span>
                    </div>
                  )
                })}
                <span className="num-m" style={{ marginLeft: 'auto', fontSize: 32 }}>
                  {guard.kept.length}/{stats.daysTracked}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
