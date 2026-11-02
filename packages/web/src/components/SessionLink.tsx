import type { ReactNode } from 'react'

import { useShell } from '../shell/ShellContext'
import { TextButton } from './TextButton'

/** Opens an AI session (a job or card run) in the chat beside the page, keeping the page in view. */
export function SessionLink({
  sessionId,
  className = '',
  style,
  children,
}: {
  sessionId: string
  className?: string
  style?: React.CSSProperties
  children: ReactNode
}) {
  const shell = useShell()
  return (
    <TextButton
      className={className}
      style={style}
      onClick={(e) => {
        // Inside a clickable card: open the session, not the card.
        e.stopPropagation()
        shell.openSession(sessionId)
      }}
    >
      {children}
    </TextButton>
  )
}
