import { shares, volumeLabel } from '../helpers/training'
import type { Units } from '../types/training'

/** Volume per period as bars (one series, so no legend); hover a bar for its value. */
export function VolumeBars({ points, units }: { points: Array<{ label: string; kg: number }>; units: Units }) {
  const heights = shares(points.map((p) => p.kg))
  const max = Math.max(0, ...points.map((p) => p.kg))
  return (
    <div className="col g8">
      <span className="mono-s muted">max {volumeLabel(max, units)}</span>
      <div className="tr-bars" role="list" aria-label="Volume">
        {points.map((p, i) => (
          <div key={p.label} role="listitem" className="tr-bar" title={`${p.label} · ${volumeLabel(p.kg, units)}`}>
            <span
              className="tr-bar-fill"
              style={{ height: `${Math.max(p.kg > 0 ? 2 : 0, (heights[i] ?? 0) * 100)}%` }}
            />
            <span className="sr-only">
              {p.label}: {volumeLabel(p.kg, units)}
            </span>
          </div>
        ))}
      </div>
      <div className="row between mono-s muted">
        <span>{points[0]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>
    </div>
  )
}
