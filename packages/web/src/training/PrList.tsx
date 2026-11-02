import { Link } from 'react-router'

import { shortDate } from '../helpers/becoming'
import { deltaLabel, weightLabel } from '../helpers/training'
import type { ProgressPr, Units } from '../types/training'

/** Best estimated one-rep max per exercise, with how much it grew. */
export function PrList({
  prs,
  units,
  linkTo,
}: {
  prs: ProgressPr[]
  units: Units
  /** Where an exercise's name leads (its detail beside the list). */
  linkTo: (exercise: string) => string
}) {
  if (prs.length === 0) return <span className="small muted">No records in this range yet.</span>
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Exercise</th>
          <th>Best set</th>
          <th>e1RM</th>
          <th>Change</th>
        </tr>
      </thead>
      <tbody>
        {prs.map((p) => (
          <tr key={p.exercise}>
            <td>
              <Link to={linkTo(p.exercise)} className="link-inline">
                {p.name}
              </Link>
              <span className="mono-s muted"> · {shortDate(p.date)}</span>
            </td>
            <td className="small">
              {weightLabel(p.kg, units)} × {p.reps}
            </td>
            <td className="small">{weightLabel(p.e1rm, units)}</td>
            <td className="mono-s">{p.delta === undefined ? 'new' : deltaLabel(p.delta, units)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
