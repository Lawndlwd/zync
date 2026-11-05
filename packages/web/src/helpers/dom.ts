import type { MouseEvent } from 'react'

import { clamp } from './math'

const MENU_WIDTH = 220
const MENU_HEIGHT = 340

/** Where a menu opened from a control goes: under it, right-aligned, and always on screen. */
export const menuAnchor = (r: { left: number; right: number; bottom: number }) => ({
  x: keepInViewport(r.right - MENU_WIDTH, MENU_WIDTH),
  y: clamp(r.bottom, 8, window.innerHeight - MENU_HEIGHT),
})

export const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/** A click handler that runs `fn` without letting the click reach the parent (e.g. a card's own click). */
export const stopPropagation = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation()
  fn()
}

/** A left edge that keeps a `width`-wide layer inside the window, 8px from its sides. */
export const keepInViewport = (left: number, width: number) => clamp(left, 8, window.innerWidth - width - 8)
