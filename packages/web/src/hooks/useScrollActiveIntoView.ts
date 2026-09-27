import { type RefObject, useEffect } from 'react'

/**
 * Keeps the highlighted row of a list scrolled into view when the highlight moves to `index`
 * (-1: none). The row is found in `ref` by `selector`.
 */
export function useScrollActiveIntoView(ref: RefObject<HTMLElement | null>, index: number, selector = '.mi.on') {
  useEffect(() => {
    if (index < 0) return
    ref.current?.querySelector(selector)?.scrollIntoView({ block: 'nearest' })
  }, [ref, index, selector])
}
