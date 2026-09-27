import { useState } from 'react'

/**
 * Relative widths of the sides (flex-grow values, summing to the number of sides), remembered per
 * layout size in this browser. Equal widths when nothing is saved or the count changes.
 */
export function usePaneSizes(count: number) {
  const key = `zync:paneSizes:${count}`
  const read = (): number[] => {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? 'null')
      if (Array.isArray(v) && v.length === count && v.every((n) => typeof n === 'number' && n > 0)) return v
    } catch {}
    return Array(count).fill(1)
  }
  const [state, setState] = useState(() => ({ count, sizes: read() }))
  // A pane opened or closed: switch to that layout's saved (or equal) widths.
  const sizes = state.count === count ? state.sizes : read()
  const set = (next: number[]) => {
    setState({ count, sizes: next })
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {}
  }
  return [sizes, set] as const
}
