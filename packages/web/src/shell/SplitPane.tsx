import type { CSSProperties, ReactNode } from 'react'

import { IconButton } from '../components/IconButton'
import { IconCross } from '../icons'
import { PaneHeader } from './PaneHeader'
import { PaneIdContext } from './paneId'
import { PaneRouter } from './PaneRouter'

// A split pane: any workspace view (board, page, jobs…) beside the main one. Each pane has its own
// router, so links clicked inside it navigate that pane only.

export function SplitPane({
  id,
  path,
  title,
  onPath,
  onEscape,
  onMakeMain,
  onClose,
  style,
  active,
  onSelect,
  register,
}: {
  id: string
  style?: CSSProperties
  path: string
  active: boolean
  onSelect: () => void
  register: (go: ((to: string) => void) | null) => void
  title: ReactNode
  onPath: (path: string) => void
  onEscape: (path: string) => void
  onMakeMain: () => void
  onClose: () => void
}) {
  return (
    <section
      className={`pane${active ? ' active' : ''}`}
      style={style}
      aria-label={`Split pane: ${typeof title === 'string' ? title : 'view'}`}
      onPointerDownCapture={onSelect}
      onFocusCapture={onSelect}
    >
      <PaneHeader title={title} active={active}>
        <IconButton small label="Make this the main view" onClick={onMakeMain}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M2.5 5.5h9M9 3l2.5 2.5L9 8M13.5 10.5h-9M7 8l-2.5 2.5L7 13" />
          </svg>
        </IconButton>
        <IconButton small label="Close pane" onClick={onClose}>
          <IconCross size={13} sw={1.6} />
        </IconButton>
      </PaneHeader>
      <div className="pane-scroll">
        <PaneIdContext.Provider value={id}>
          <PaneRouter initial={path} onPath={onPath} onEscape={onEscape} register={register} />
        </PaneIdContext.Provider>
      </div>
    </section>
  )
}
