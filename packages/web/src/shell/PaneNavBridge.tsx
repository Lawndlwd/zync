import { useEffect, useEffectEvent } from 'react'
import { useNavigate } from 'react-router'

/** Lets the layout navigate this pane (sidebar and ⌘K open things in the selected side). */
export function PaneNavBridge({ register }: { register: (go: ((to: string) => void) | null) => void }) {
  const navigate = useNavigate()
  const reg = useEffectEvent(register)
  useEffect(() => {
    reg((to) => void navigate(to))
    return () => reg(null)
  }, [navigate])
  return null
}
