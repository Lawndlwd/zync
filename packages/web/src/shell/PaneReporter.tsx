import { useEffect, useEffectEvent } from 'react'
import { useLocation } from 'react-router'

/** Report the pane's own location changes, and hand the chat route over to the main window. */
export function PaneReporter({
  onPath,
  onEscape,
}: {
  onPath: (path: string) => void
  onEscape: (path: string) => void
}) {
  const loc = useLocation()
  const path = loc.pathname + loc.search
  const report = useEffectEvent((p: string) => {
    if (/^\/w\/[^/]+\/chat(\/|$)/.test(p)) onEscape(p)
    else onPath(p)
  })
  useEffect(() => report(path), [path])
  return null
}
