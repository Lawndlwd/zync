import { useEffect, useEffectEvent } from 'react'

/** Calls `fn` every `ms` while mounted; `ms: null` pauses. `fn` always sees the latest render. */
export function useInterval(fn: () => void, ms: number | null) {
  const tick = useEffectEvent(fn)
  useEffect(() => {
    if (ms === null) return
    const t = window.setInterval(() => tick(), ms)
    return () => window.clearInterval(t)
  }, [ms])
}
