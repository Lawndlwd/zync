import { weekCellText, type WeekCell } from '../helpers/training'

/** Monday → Sunday: trained days filled, planned days outlined, today marked. */
export function WeekStrip({ cells }: { cells: WeekCell[] }) {
  return (
    <div className="tr-week" role="list" aria-label="This week">
      {cells.map((c) => (
        <div
          key={c.date}
          role="listitem"
          className={`tr-day${c.trained ? ' done' : ''}${c.today ? ' today' : ''}${c.planned && !c.trained ? ' planned' : ''}${c.future ? ' future' : ''}`}
          title={`${c.day} ${c.n} · ${weekCellText(c)}`}
        >
          <span className="mono-s">{c.day.slice(0, 2)}</span>
          <b>{c.n}</b>
        </div>
      ))}
    </div>
  )
}
