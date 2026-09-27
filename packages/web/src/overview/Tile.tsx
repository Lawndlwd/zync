import type { ReactNode } from 'react'

import { hhmm, until } from '../helpers/dates'
import { IconCheck, IconClock, IconCross, IconSkip, IconSpin } from '../icons'
import type { Slot } from '../types/overview'

export function Tile({ slot, now }: { slot: Slot; now: Date }) {
  const kind = slot.kind === 'card' ? 'Card' : 'Job'
  let cls = 'tile'
  let label = kind
  let icon: ReactNode = <IconClock size={13} sw={1.6} />
  let sub = slot.title
  switch (slot.state) {
    case 'ok':
    case 'failed':
    case 'timeout':
    case 'skipped': {
      cls = 'tile past'
      const word = { ok: 'ok', failed: 'failed', timeout: 'timed out', skipped: 'skipped' }[slot.state]
      sub = `${slot.title} · ${word}`
      icon =
        slot.state === 'ok' ? (
          <IconCheck size={13} sw={2} />
        ) : slot.state === 'skipped' ? (
          <IconSkip size={13} sw={1.8} />
        ) : (
          <IconCross size={13} sw={2} stroke="var(--danger)" />
        )
      break
    }
    case 'running':
      cls = 'tile running'
      label = `${kind} · running`
      icon = <IconSpin size={13} sw={2} />
      break
    case 'next':
      cls = 'tile sel'
      label = `Next · ${until(slot.time, now)}`
      break
    case 'planned':
      break
  }
  return (
    <div className={cls}>
      <div className="row between">
        <span className="mono-s">{label}</span>
        {icon}
      </div>
      <span className="tn">{hhmm(slot.time)}</span>
      <span className="small trunc">{sub}</span>
    </div>
  )
}
