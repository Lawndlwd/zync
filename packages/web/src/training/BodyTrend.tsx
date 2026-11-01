import { shortDate } from '../helpers/becoming'
import { toUnits, trendPoints, weightLabel } from '../helpers/training'
import type { Units } from '../types/training'

const W = 320
const H = 120

/** Body weight over time as one line; each weigh-in is a dot with its value on hover. */
export function BodyTrend({ points, units }: { points: Array<{ date: string; kg: number }>; units: Units }) {
  if (points.length === 0) return <span className="small muted">No body weight logged in this range.</span>
  const values = points.map((p) => toUnits(p.kg, units))
  const line = trendPoints(values, W, H, 8)
  const coords = line.split(' ').map((xy) => xy.split(',').map(Number))
  const first = points[0]
  const last = points.at(-1)
  return (
    <div className="col g8">
      <div className="row between">
        <span className="num-m">{last ? weightLabel(last.kg, units) : ''}</span>
        {first && last && points.length > 1 && (
          <span className="mono-s muted">
            from {weightLabel(first.kg, units)} on {shortDate(first.date)}
          </span>
        )}
      </div>
      <svg className="tr-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Body weight trend">
        <polyline points={line} />
        {points.map((p, i) => {
          const [x = 0, y = 0] = coords[i] ?? []
          return (
            <circle key={p.date} cx={x} cy={y} r={4}>
              <title>{`${shortDate(p.date)} · ${weightLabel(p.kg, units)}`}</title>
            </circle>
          )
        })}
      </svg>
    </div>
  )
}
