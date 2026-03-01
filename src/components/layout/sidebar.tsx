import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Inbox,
  LayoutDashboard,
  ListTodo,
  BookOpen,
  Settings,
  Ticket,
  BarChart3,
  Activity,
  GitMerge,
  FileText,
  Terminal,
} from 'lucide-react'
import { useOpenCodeStore } from '@/store/opencode'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', color: 'text-indigo-400' },
  { to: '/inbox', icon: Inbox, label: 'Inbox', color: 'text-sky-400' },
  { to: '/jira', icon: Ticket, label: 'Jira', color: 'text-blue-400' },
  { to: '/todos', icon: ListTodo, label: 'To-Do', color: 'text-emerald-400' },
  { to: '/journal', icon: BookOpen, label: 'Journal', color: 'text-amber-400' },
  { to: '/productivity', icon: BarChart3, label: 'Productivity', color: 'text-orange-400' },
  { to: '/activity', icon: Activity, label: 'Activity', color: 'text-rose-400' },
  { to: '/gitlab', icon: GitMerge, label: 'GitLab', color: 'text-violet-400' },
  { to: '/documents', icon: FileText, label: 'Documents', color: 'text-teal-400' },
  { to: '/opencode', icon: Terminal, label: 'OpenCode', color: 'text-cyan-400' },
]

export function Sidebar() {
  const ocConnected = useOpenCodeStore((s) => s.connectionStatus.connected)
  const ocServerUrl = useOpenCodeStore((s) => s.serverUrl)

  return (
    <aside className="flex h-screen w-16 flex-col items-center border-r border-white/[0.06] bg-black/40 backdrop-blur-xl py-4 lg:w-60">
      {/* OpenCode status card */}
      <div className="mb-6 px-3 w-full">
        <div className={cn(
          'rounded-xl border px-3 py-3 transition-colors',
          ocConnected
            ? 'border-emerald-500/20 bg-emerald-500/5'
            : 'border-red-400/20 bg-red-400/5'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-3 w-3 shrink-0 rounded-full',
              ocConnected ? 'bg-emerald-400/80' : 'bg-red-400/70'
            )} />
            <div className="hidden lg:block min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">
                {ocConnected ? 'OpenCode' : 'Offline'}
              </p>
              <p className={cn(
                'text-xs',
                ocConnected ? 'text-emerald-400/80' : 'text-red-400/70'
              )}>
                {ocConnected
                  ? `${ocServerUrl} · Local`
                  : 'Server unreachable'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 w-full">
        {links.map(({ to, icon: Icon, label, color }) => (
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
        ))}
      </nav>

      {/* Bottom section */}
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
      </div>
    </aside>
  )
}
