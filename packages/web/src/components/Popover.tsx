import { type CSSProperties, type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDismiss } from '../ui'

/**
 * Floating layer anchored to an element. Rendered in a portal with fixed positioning so panels
 * with `overflow: hidden` never clip it; flips above the anchor when there's no room below.
 */
export function Popover({
  anchor,
  open,
  onClose,
  align = 'start',
  matchWidth,
  className = 'menu',
  style,
  role,
  children,
}: {
  anchor: RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  align?: 'start' | 'end'
  matchWidth?: boolean
  className?: string
  style?: CSSProperties
  role?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<CSSProperties>({ visibility: 'hidden' })
  useDismiss(ref, open, onClose, anchor)

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const a = anchor.current?.getBoundingClientRect()
      const el = ref.current
      if (!a || !el) return
      const h = el.offsetHeight
      const w = matchWidth ? a.width : el.offsetWidth
      const below = window.innerHeight - a.bottom
      const top = below < h + 12 && a.top > below ? Math.max(8, a.top - h - 6) : a.bottom + 6
      let left = align === 'end' ? a.right - w : a.left
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
      setPos({ top, left, ...(matchWidth ? { width: a.width } : {}) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchor, align, matchWidth])

  if (!open) return null
  return createPortal(
    <div ref={ref} className={`${className} floating`} style={{ ...pos, ...style }} role={role}>
      {children}
    </div>,
    document.body,
  )
}
