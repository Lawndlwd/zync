import { plural } from '../helpers/format'

export function HeatRow({ label, cells, now }: { label: string; cells: number[]; now: number }) {
  return (
    <>
      <span className="mono-s muted" style={{ alignSelf: 'center' }}>
        {label}
      </span>
      {cells.map((v, i) => (
        <i
          // oxlint-disable-next-line react/no-array-index-key -- one cell per fixed time slot
          key={i}
          className={`hc l${Math.min(v, 3)}${i === now ? ' now' : ''}`}
          title={plural(v, 'item')}
        />
      ))}
    </>
  )
}
