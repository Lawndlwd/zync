import type { CSSProperties } from 'react'

import { IconCheck, IconSpin } from '../icons'
import type { SaveState } from '../types/save'

/** "Saved" / "Saving…" / "Unsaved" / "Save failed" (with the error as a tooltip), next to an editor. */
export function SaveStatus({ state, error, style }: { state: SaveState; error?: string; style?: CSSProperties }) {
  if (state === 'error')
    return (
      <span className="mono-s danger-t" role="status" title={error} style={style}>
        Save failed
      </span>
    )
  return (
    <span className="mono-s row g6" role="status" style={style}>
      {state === 'saved' ? <IconCheck size={12} sw={2} /> : <IconSpin size={12} />}
      {state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : 'Unsaved'}
    </span>
  )
}
