import { useState } from 'react'

import { Button } from '../components/Button'
import { guardAt } from '../helpers/becoming'
import { useIdentities } from '../hooks/useIdentities'
import { IconShield } from '../icons'

/** Under a time field: the time falls inside a guard, offer the time just before it. */
export function GuardHint({
  ws,
  stamp,
  onMove,
}: {
  ws: string
  stamp?: string | undefined
  onMove: (stamp: string) => void
}) {
  const identities = useIdentities(ws)
  const [kept, setKept] = useState<string | null>(null)
  const hit = stamp ? guardAt(stamp, identities.data ?? []) : null
  if (!stamp || !hit || kept === stamp) return null
  return (
    <div className="guard-hint col g8">
      <span className="small row g8" style={{ alignItems: 'flex-start' }}>
        <IconShield size={14} style={{ marginTop: 3 }} />
        <span>
          Outside “{hit.guard.label.toLowerCase()}” ({hit.guard.from}–{hit.guard.to}) — keep anyway?
        </span>
      </span>
      <div className="row g6">
        <Button variant="primary" size="sm" onClick={() => onMove(`${stamp.slice(0, 10)}T${hit.suggest}`)}>
          Move to {hit.suggest}
        </Button>
        <Button size="sm" onClick={() => setKept(stamp)}>
          Keep {stamp.slice(11, 16)}
        </Button>
      </div>
    </div>
  )
}
