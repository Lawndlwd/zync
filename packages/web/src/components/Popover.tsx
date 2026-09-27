import { type CSSProperties, type ReactNode, type RefObject, useRef } from 'react'
import { createPortal } from 'react-dom'

import { keepInViewport } from '../helpers/dom'
import { useAnchoredPosition } from '../hooks/useAnchoredPosition'
import { useDismiss } from '../hooks/useDismiss'

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
  useDismiss(ref, open, onClose, anchor)
  const pos = useAnchoredPosition(
    ref,
    () => {
      const a = anchor.current?.getBoundingClientRect()
      const el = ref.current
      if (!a || !el) return null
      const h = el.offsetHeight
      const w = matchWidth ? a.width : el.offsetWidth
      const below = window.innerHeight - a.bottom
      const top = below < h + 12 && a.top > below ? Math.max(8, a.top - h - 6) : a.bottom + 6
      let left = align === 'end' ? a.right - w : a.left
      left = keepInViewport(left, w)
      return { top, left, ...(matchWidth ? { width: a.width } : {}) }
    },
    { enabled: open },
  )

  if (!open) return null
  return createPortal(
    <div ref={ref} className={`${className} floating`} style={{ ...pos, ...style }} role={role}>
      {children}
    </div>,
    document.body,
  )
}
