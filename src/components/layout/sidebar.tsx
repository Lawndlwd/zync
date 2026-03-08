import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  KanbanSquare,
  Settings,
  BarChart3,
  Activity,
  FileText,
  Monitor,
  MessageCircle,
  Send,
  Mail,
  ChevronDown,
  ChevronRight,
  Briefcase,
  UserCircle,
  Share2,
} from 'lucide-react'
import { useOpenCodeStore } from '@/store/opencode'

import { useBotChannels } from '@/hooks/useBot'

type NavItem = {
  to: string
  icon: typeof LayoutDashboard
  label: string
  color: string
}

type NavGroup = {
  id: string
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    id: 'core',
    label: 'Core',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', color: 'text-indigo-400' },
      { to: '/productivity', icon: BarChart3, label: 'Productivity', color: 'text-orange-400' },
      { to: '/tasks', icon: KanbanSquare, label: 'Tasks & Projects', color: 'text-emerald-400' },
      { to: '/chat', icon: MessageCircle, label: 'Chat', color: 'text-sky-400' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    items: [
      { to: '/documents', icon: FileText, label: 'Documents', color: 'text-teal-400' },
      { to: '/activity', icon: Activity, label: 'Activity', color: 'text-rose-400' },
      { to: '/canvas', icon: Monitor, label: 'Canvas', color: 'text-pink-400' },
      { to: '/jobs', icon: Briefcase, label: 'Job Search', color: 'text-amber-400' },
      { to: '/profile', icon: UserCircle, label: 'Profile & CV', color: 'text-teal-400' },
      { to: '/social', icon: Share2, label: 'Social Media', color: 'text-fuchsia-400' },
    ],
  },
]

const channelIcons: Record<string, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  telegram: Send,
  gmail: Mail,
}

const channelColors: Record<string, string> = {
  whatsapp: 'text-green-400',
  telegram: 'text-blue-400',
  gmail: 'text-red-400',
}

export function Sidebar() {
  const ocConnected = useOpenCodeStore((s) => s.connectionStatus.connected)
  const ocServerUrl = useOpenCodeStore((s) => s.serverUrl)
  const { data: channels } = useBotChannels()
  const connectedChannels = channels?.filter((c) => c.connected) || []
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setVersion(d.version))
      .catch(() => {})
  }, [])

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  return (
    <aside className="flex h-screen w-16 flex-col items-center border-r border-white/[0.06] bg-black/40 backdrop-blur-xl py-4 lg:w-60">
      <div className="mb-6 px-3 w-full">
        <div
          className={cn(
            'rounded-xl border px-3 py-3 transition-colors',
            ocConnected
              ? 'border-emerald-500/20 bg-emerald-500/5'
              : 'border-red-400/20 bg-red-400/5'
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-3 w-3 shrink-0 rounded-full',
                ocConnected ? 'bg-emerald-400/80' : 'bg-red-400/70'
              )}
            />
            <div className="hidden lg:block min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">
                {ocConnected ? 'OpenCode' : 'Offline'}
              </p>
              <p
                className={cn(
                  'text-xs',
                  ocConnected ? 'text-emerald-400/80' : 'text-red-400/70'
                )}
              >
                {ocConnected
                  ? `${ocServerUrl} · Local`
                  : 'Server unreachable'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {connectedChannels.length > 0 && (
        <div className="mb-4 px-3 w-full">
          <div className="flex items-center gap-2 lg:gap-0 lg:flex-col lg:items-stretch">
            {connectedChannels.map((ch) => {
              const Icon = channelIcons[ch.channel] || MessageCircle
              const color = channelColors[ch.channel] || 'text-zinc-400'
              return (
                <div
                  key={ch.channel}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 lg:mb-1"
                >
                  <Icon size={14} className={cn('shrink-0', color)} />
                  <span className={cn('hidden lg:block text-xs font-medium capitalize', color)}>
                    {ch.channel}
                  </span>
                  <div className="hidden lg:flex ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-1 px-3 w-full overflow-y-auto">
        {navGroups.map((group, groupIndex) => (
          <div key={group.id}>
            {groupIndex > 0 && (
              <div className="my-2 border-t border-white/[0.06] lg:my-3" />
            )}
            <button
              onClick={() => toggleGroup(group.id)}
              className={cn(
                'mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500 transition-colors lg:mb-2 hover:text-zinc-400',
                'hidden lg:flex'
              )}
            >
              {collapsedGroups[group.id] ? (
                <ChevronRight size={12} />
              ) : (
                <ChevronDown size={12} />
              )}
              {group.label}
            </button>
            <div className="flex flex-col gap-1">
              {group.items.map(({ to, icon: Icon, label, color }) => {
                const isCollapsed = collapsedGroups[group.id]
                if (isCollapsed) return null
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-white/[0.08] text-zinc-100'
                          : 'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={20} className={cn('shrink-0', isActive ? color : '')} />
                        <span className="hidden lg:block truncate">{label}</span>
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-1 px-3 w-full border-t border-white/[0.06] pt-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-zinc-800/80 text-zinc-100'
                : 'text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300'
            )
          }
        >
          {({ isActive }) => (
            <>
              <Settings size={20} className={cn('shrink-0', isActive ? 'text-zinc-300' : '')} />
              <span className="hidden lg:block">Settings</span>
            </>
          )}
        </NavLink>
        {version && (
          <p className="mt-2 text-center text-[10px] text-zinc-600 hidden lg:block">v{version}</p>
        )}
      </div>
    </aside>
  )
}
