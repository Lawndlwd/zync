import type { ReactNode } from 'react'

import { PathBar } from './PathBar'

export function FileFrame({
  ws,
  path,
  fill,
  children,
}: {
  ws: string
  path: string
  fill?: boolean
  children: ReactNode
}) {
  return (
    <div className="fileview">
      <PathBar ws={ws} path={path} />
      <div className={`page file-page${fill ? ' fill' : ''}`}>{children}</div>
    </div>
  )
}
