import { useState } from 'react'

import { useInterval } from './useInterval'

/** The current time, refreshed every `ms`. */
export function useNow(ms: number): Date {
  const [now, setNow] = useState(() => new Date())
  useInterval(() => setNow(new Date()), ms)
  return now
}
