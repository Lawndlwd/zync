import { type CSSProperties, type RefObject, useEffectEvent, useLayoutEffect, useState } from 'react'

const HIDDEN: CSSProperties = { visibility: 'hidden' }

/**
 * Fixed position for a floating layer, from `compute` (null = can't measure yet). Re-placed before
 * paint when enabled or `at` changes, and on resize, scroll, or when the layer itself changes size.
 * Hidden until first placed.
 */
export function useAnchoredPosition(
  floating: RefObject<HTMLElement | null>,
  compute: () => CSSProperties | null,
  { enabled = true, at }: { enabled?: boolean; at?: unknown } = {},
): CSSProperties {
  const [pos, setPos] = useState<CSSProperties | null>(null)
  // `_at` only marks why it runs: the anchor moved.
  const place = useEffectEvent((_at?: unknown) => {
    const next = compute()
    if (next) setPos(next)
  })
  useLayoutEffect(() => {
    if (!enabled) return
    // oxlint-disable-next-line react/set-state-in-effect -- placing needs the rendered layer's size
    place(at)
    const onChange = () => place()
    const el = floating.current
    const ro = typeof ResizeObserver === 'undefined' || !el ? null : new ResizeObserver(onChange)
    if (el) ro?.observe(el)
    window.addEventListener('resize', onChange)
    window.addEventListener('scroll', onChange, true)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', onChange)
      window.removeEventListener('scroll', onChange, true)
    }
  }, [enabled, at, floating])
  return pos ?? HIDDEN
}
