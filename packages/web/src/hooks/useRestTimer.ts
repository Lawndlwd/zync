import { useState } from 'react'

import { extendRest, restLeft } from '../helpers/training'
import { useInterval } from './useInterval'

/**
 * The rest timer between sets. It keeps the moment rest ends, so it stays right when the tab
 * sleeps; it ticks only while running and stops by itself at zero.
 */
export function useRestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  useInterval(
    () => {
      const t = Date.now()
      setNow(t)
      if (endsAt !== null && t >= endsAt) setEndsAt(null)
    },
    endsAt === null ? null : 250,
  )

  const start = (seconds: number) => {
    const t = Date.now()
    setNow(t)
    setTotal(seconds)
    setEndsAt(t + seconds * 1000)
  }
  const add = (seconds: number) => {
    const t = Date.now()
    setNow(t)
    setTotal((x) => x + seconds)
    setEndsAt((e) => extendRest(e ?? t, t, seconds))
  }
  const skip = () => setEndsAt(null)

  return {
    running: endsAt !== null,
    /** Seconds left. */
    left: endsAt === null ? 0 : restLeft(endsAt, now),
    /** Seconds the rest was set to (with the time added), for the progress bar. */
    total,
    start,
    add,
    skip,
  }
}
