import { Link } from 'react-router'

/** Number + label chip; `bad` switches to the danger pair. */
export function Chip({ n, label, bad, to }: { n: number; label: string; bad?: boolean; to?: string }) {
  const inner = (
    <>
      <b>{n}</b>
      <span>{label}</span>
    </>
  )
  const cls = `chip${bad ? ' bad' : ''}`
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <span className={cls}>{inner}</span>
  )
}
