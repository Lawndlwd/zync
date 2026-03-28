import { format } from 'date-fns'
import { useEffect, useState } from 'react'

export function PlannerClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const time = format(now, 'HH:mm:ss')
  const date = format(now, 'EEE, MMM d')

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="text-6xl font-light tracking-wider text-white tabular-nums font-mono">{time}</div>
      <div className="mt-2 text-base font-medium text-muted-foreground">{date}</div>
    </div>
  )
}
