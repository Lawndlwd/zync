import { ymd } from '../helpers/dates'
import { isFailedRun } from '../helpers/runs'
import { wsUrl } from '../helpers/urls'
import { useBecomingToday } from '../hooks/useBecomingToday'
import { useNow } from '../hooks/useNow'
import { useTrainingToday } from '../hooks/useTrainingToday'
import {
  IconBecoming,
  IconBoard,
  IconCalendar,
  IconClock,
  IconFile,
  IconGrid,
  IconMemory,
  IconPeople,
  IconSettings,
  IconSpark,
  IconTraining,
} from '../icons'
import type { Creating } from '../types/shell'
import type { WorkspaceData } from '../types/workspace'
import { SidebarItem } from './SidebarItem'
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
  const now = useNow(60_000)
  const becoming = useBecomingToday(ws, ymd(now))
  const training = useTrainingToday(ws)
  const voted = becoming.data?.rows.filter((r) => r.vote).length ?? 0
  const failed = data.jobs.filter((j) => isFailedRun(j.lastRun?.status)).length

  return (
    <aside
      className={`side${icons && !drawer ? ' icons' : ''}${drawer ? ' drawer' : ''}`}
      aria-label="Workspace navigation"
      onClick={(e) => {
        if (e.target instanceof HTMLElement && e.target.closest('a')) onNavigate()
      }}
    >
      <nav className="nav" aria-label="Sections">
        <SidebarItem to={wsUrl(ws, 'overview')} icon={<IconGrid />} label="Overview" />
        <SidebarItem to={wsUrl(ws, 'files')} icon={<IconFile />} label="Files" count={data.fileCount || undefined} />
        <SidebarItem
          to={wsUrl(ws, 'boards')}
          icon={<IconBoard />}
          label="Boards"
          count={data.boards.length || undefined}
        />
        <SidebarItem to={wsUrl(ws, 'calendar')} icon={<IconCalendar />} label="Calendar" />
        <SidebarItem
          to={wsUrl(ws, 'becoming')}
          icon={<IconBecoming />}
          label="Becoming"
          count={becoming.data?.rows.length ? `${voted}/${becoming.data.rows.length}` : undefined}
        />
        <SidebarItem
          to={wsUrl(ws, 'training')}
          icon={<IconTraining />}
          label="Training"
          count={training.data?.active ? 'live' : training.data?.planned ? 'today' : undefined}
        />
        <SidebarItem
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
          <SidebarItem to={wsUrl(ws, 'opencode')} icon={<IconSpark size={16} />} label="OpenCode" />
          <SidebarItem to={wsUrl(ws, 'memory')} icon={<IconMemory />} label="Memory" />
          <SidebarItem
            to={wsUrl(ws, 'people')}
            icon={<IconPeople />}
            label="People"
            count={data.people.length || undefined}
          />
          <SidebarItem to={wsUrl(ws, 'settings')} icon={<IconSettings />} label="Settings" />
        </nav>
      </div>
    </aside>
  )
}
