import type { ReactNode } from 'react'

import { IconCheck, IconClock, IconCross, IconSkip, IconSpin, IconTimeout } from '../icons'

export type RunState = 'ok' | 'failed' | 'timeout' | 'skipped' | 'running' | 'scheduled'

const ST: Record<RunState, { cls: string; word: string; icon: ReactNode }> = {
  ok: { cls: 'st-ok', word: 'OK', icon: <IconCheck /> },
  failed: { cls: 'st-fail', word: 'Failed', icon: <IconCross /> },
  timeout: { cls: 'st-time', word: 'Timed out', icon: <IconTimeout /> },
  skipped: { cls: 'st-skip', word: 'Skipped', icon: <IconSkip /> },
  running: { cls: 'st-run', word: 'Running', icon: <IconSpin size={11} sw={2.2} /> },
  scheduled: { cls: 'st-sched', word: 'Scheduled', icon: <IconClock size={11} sw={1.8} /> },
}

/** Run / AI state badge — always glyph + word, never colour alone. */
export function StatusBadge({ state, children }: { state: RunState; children?: ReactNode }) {
  const s = ST[state]
  return (
    <span className={`st ${s.cls}`}>
      {s.icon}
      {children ?? s.word}
    </span>
  )
}
