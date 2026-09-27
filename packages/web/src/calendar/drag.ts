/**
 * Pointer drag with a small dead zone, tracked on the window so it keeps working when the pointer
 * leaves the element. `end(false)` means it was a click.
 */
export function startDrag(
  e: { clientX: number; clientY: number; button: number; preventDefault: () => void },
  on: { move: (x: number, y: number) => void; end: (moved: boolean) => void },
) {
  if (e.button !== 0) return
  e.preventDefault()
  const x0 = e.clientX
  const y0 = e.clientY
  let moved = false
  const move = (ev: PointerEvent) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return
    moved = true
    on.move(ev.clientX, ev.clientY)
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    document.body.classList.remove('cal-dragging')
    on.end(moved)
  }
  document.body.classList.add('cal-dragging')
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
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
