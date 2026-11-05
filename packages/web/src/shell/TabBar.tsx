import { IconButton } from '../components/IconButton'
import { wsUrl } from '../helpers/urls'
import { IconBoard, IconCalendar, IconGrid, IconMenu, IconSpark } from '../icons'
import { SidebarItem } from './SidebarItem'

/** Phone navigation within thumb reach: the main sections, and "More" for the drawer with everything else. */
export function TabBar({
  ws,
  running,
  moreOn,
  drawerOpen,
  onMore,
  onNavigate,
}: {
  ws: string
  running: number
  moreOn: boolean
  drawerOpen: boolean
  onMore: () => void
  onNavigate: () => void
}) {
  return (
    <nav
      className="tabbar"
      aria-label="Main sections"
      onClick={(e) => {
        if (e.target instanceof HTMLElement && e.target.closest('a')) onNavigate()
      }}
    >
      <SidebarItem to={wsUrl(ws, 'overview')} icon={<IconGrid />} label="Home" />
      <SidebarItem to={wsUrl(ws, 'boards')} icon={<IconBoard />} label="Boards" />
      <SidebarItem
        to={wsUrl(ws, 'chat')}
        icon={<IconSpark size={16} />}
        label="Chat"
        count={running || undefined}
        tour="chat"
      />
      <SidebarItem to={wsUrl(ws, 'calendar')} icon={<IconCalendar />} label="Calendar" />
      <IconButton
        label="More sections and files"
        className={`tabbar-more${moreOn ? ' on' : ''}`}
        aria-expanded={drawerOpen}
        onClick={onMore}
      >
        <IconMenu />
        <span className="lbl">More</span>
      </IconButton>
    </nav>
  )
}
