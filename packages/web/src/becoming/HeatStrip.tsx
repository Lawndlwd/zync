import { STRIP_CLASS } from '../helpers/becoming'
import type { StripCell } from '../types/becoming'

/** The last four weeks, a week per group, oldest first. */
export function HeatStrip({ cells, large = false }: { cells: StripCell[]; large?: boolean }) {
  const weeks = [0, 7, 14, 21].map((start) => cells.slice(start, start + 7))
  return (
    <div className={`hstrip${large ? ' lg' : ''}`} role="img" aria-label="Last 4 weeks">
      {weeks.map((week, w) => (
        // oxlint-disable-next-line react/no-array-index-key -- fixed positional weeks, never reordered
        <div className="wk" key={w}>
          {week.map((c, d) => (
            // oxlint-disable-next-line react/no-array-index-key -- fixed positional days, never reordered
            <i key={d} className={STRIP_CLASS[c]} />
          ))}
        </div>
      ))}
    </div>
  )
}
