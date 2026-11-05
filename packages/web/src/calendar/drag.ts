/**
 * Pointer drag with a small dead zone, tracked on the window so it keeps working when the pointer
 * leaves the element. `end(false)` means it was a click. A finger that moves is scrolling the page,
 * so touch never drags: a tap is a click, anything else is left to the browser.
 */
export function startDrag(
  e: { clientX: number; clientY: number; button: number; pointerType: string; preventDefault: () => void },
  on: { move: (x: number, y: number) => void; end: (moved: boolean) => void },
) {
  if (e.button !== 0) return
  e.preventDefault()
  const x0 = e.clientX
  const y0 = e.clientY
  const touch = e.pointerType === 'touch'
  let moved = false
  const move = (ev: PointerEvent) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return
    moved = true
    if (!touch) on.move(ev.clientX, ev.clientY)
  }
  const finish = (ev: Event) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', finish)
    document.body.classList.remove('cal-dragging')
    if (!touch || (!moved && ev.type === 'pointerup')) on.end(moved)
  }
  document.body.classList.add('cal-dragging')
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', finish)
}

/** The `[data-day]` element under x (and y, when given) inside `root`. */
export function dayAt(root: HTMLElement | null, x: number, y?: number): { day: string; rect: DOMRect } | null {
  if (!root) return null
  for (const el of root.querySelectorAll<HTMLElement>('[data-day]')) {
    const r = el.getBoundingClientRect()
    const day = el.dataset.day
    if (day && x >= r.left && x < r.right && (y === undefined || (y >= r.top && y < r.bottom))) return { day, rect: r }
  }
  return null
}
