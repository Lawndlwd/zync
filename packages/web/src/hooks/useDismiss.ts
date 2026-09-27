import type { RefObject } from 'react'

import { useEventListener } from './useEventListener'

/** Close a popover on outside click or Escape. Clicks inside `also` (e.g. its trigger) don't count. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
  also?: RefObject<HTMLElement | null>,
) {
  useEventListener(
    'mousedown',
    (e) => {
      const t = e.target
      if (t instanceof Node && (ref.current?.contains(t) || also?.current?.contains(t))) return
      close()
    },
    { target: document, enabled: open },
  )
  useEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    },
    { target: document, capture: true, enabled: open },
  )
}
