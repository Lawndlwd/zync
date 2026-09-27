import type { CSSProperties } from 'react'

export function QuickAccess({
  quick,
}: {
  quick: Record<'newPage' | 'newCard' | 'schedule' | 'ask' | 'boards', () => void>
}) {
  const row: CSSProperties = { color: 'var(--on-accent)', width: '100%', textAlign: 'left' }
  const key: CSSProperties = { marginLeft: 'auto', opacity: 0.6 }
  const items: Array<[string, () => void, string]> = [
    ['[+] New page', quick.newPage, 'N'],
    ['[+] New card', quick.newCard, 'C'],
    ['[+] Schedule AI job', quick.schedule, 'S'],
    ['[↗] Ask AI', quick.ask, '⌘J'],
    ['[↗] All boards', quick.boards, 'B'],
  ]
  return (
    <section className="card hero c-hero" style={{ justifyContent: 'space-between' }}>
      <div>
        <div className="card-h">
          <span className="t">Quick access</span>
          <span className="m">⌘K</span>
        </div>
        <p className="h2" style={{ color: 'var(--on-accent)', maxWidth: 220 }}>
          Start something, or hand it off.
        </p>
      </div>
      <div className="col" style={{ marginTop: 24 }}>
        {items.map(([label, fn, k]) => (
          <button key={label} className="lr mono" style={row} onClick={fn}>
            {label}
            <span style={key}>{k}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
