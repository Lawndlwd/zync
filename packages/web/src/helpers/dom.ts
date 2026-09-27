import type { MouseEvent } from 'react'

import { clamp } from './math'

export const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/** A click handler that runs `fn` without letting the click reach the parent (e.g. a card's own click). */
export const stopPropagation = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation()
  fn()
}

/** A left edge that keeps a `width`-wide layer inside the window, 8px from its sides. */
export const keepInViewport = (left: number, width: number) => clamp(left, 8, window.innerWidth - width - 8)
