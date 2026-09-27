import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import {
  IconBoard,
  IconCalendar,
  IconClock,
  IconFile,
  IconGrid,
  IconMemory,
  IconPeople,
  IconSettings,
  IconSpark,
} from '../icons'
import type { WorkspaceData } from '../workspaceData'
import { type Creating, wsUrl } from './context'
import { SideTree } from './SideTree'

export function Sidebar({
  ws,
  data,
  icons,
  drawer,
  onNavigate,
  creating,
  setCreating,
}: {
  ws: string
  data: WorkspaceData
  icons: boolean
  drawer: boolean
  onNavigate: () => void
  creating: Creating | null
  setCreating: (c: Creating | null) => void
}) {
  const failed = data.jobs.filter((j) => j.lastRun?.status === 'failed' || j.lastRun?.status === 'timeout').length

  return (
    <aside
      className={`side${icons && !drawer ? ' icons' : ''}${drawer ? ' drawer' : ''}`}
      aria-label="Workspace navigation"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a')) onNavigate()
      }}
    >
      <nav className="nav" aria-label="Sections">
        <Item to={wsUrl(ws, 'overview')} icon={<IconGrid />} label="Overview" />
        <Item to={wsUrl(ws, 'files')} icon={<IconFile />} label="Files" count={data.fileCount || undefined} />
        <Item to={wsUrl(ws, 'boards')} icon={<IconBoard />} label="Boards" count={data.boards.length || undefined} />
        <Item to={wsUrl(ws, 'calendar')} icon={<IconCalendar />} label="Calendar" />
        <Item
          to={wsUrl(ws, 'jobs')}
          icon={<IconClock />}
          label="Jobs"
          count={failed ? `${failed} failed` : data.jobs.length || undefined}
          bad={failed > 0}
        />
      </nav>
      <SideTree ws={ws} data={data} creating={creating} setCreating={setCreating} />
      <div className="side-foot">
        <nav className="nav" aria-label="Account">
          <Item to={wsUrl(ws, 'opencode')} icon={<IconSpark size={16} />} label="OpenCode" />
          <Item to={wsUrl(ws, 'memory')} icon={<IconMemory />} label="Memory" />
          <Item to={wsUrl(ws, 'people')} icon={<IconPeople />} label="People" count={data.people.length || undefined} />
          <Item to={wsUrl(ws, 'settings')} icon={<IconSettings />} label="Settings" />
        </nav>
      </div>
    </aside>
  )
}

function Item({
  to,
  icon,
  label,
  count,
  bad,
}: {
  to: string
  icon: ReactNode
  label: string
  count?: number | string
  bad?: boolean
}) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'on' : '')} aria-label={label}>
      {icon}
      <span className="lbl">{label}</span>
      {count !== undefined && <span className={`c${bad ? ' bad' : ''}`}>{count}</span>}
    </NavLink>
  )
}
