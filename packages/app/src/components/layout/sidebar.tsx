import {
  Activity,
  FileText,
  Gamepad2,
  KanbanSquare,
  Laptop,
  MessageCircle,
  Monitor,
  Moon,
  Settings,
  Shield,
  Sun,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useOpenCodeStore } from '@/store/opencode'
import { type Theme, useThemeStore } from '@/store/theme'

const themeIcon = { light: Sun, dark: Moon, system: Laptop } as const
const themeNext: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' }

type NavItem = {
  to: string
  icon: typeof MessageCircle
  label: string
}

const navItems: NavItem[] = [
  { to: '/s/game-board', icon: Gamepad2, label: 'Life OS' },
  { to: '/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/tasks', icon: KanbanSquare, label: 'Projects' },
  { to: '/activity', icon: Activity, label: 'Activity' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/canvas', icon: Monitor, label: 'Canvas' },
  { to: '/vault', icon: Shield, label: 'Vault' },
]

export function Sidebar() {
  const ocConnected = useOpenCodeStore((s) => s.connectionStatus.connected)
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setVersion(d.version))
      .catch(() => {})
  }, [])

  return (
    <aside className="flex h-screen w-14 shrink-0 flex-col items-center border-r border-border bg-card py-4">
      {/* Status dot */}
      <div className="mb-3">
        <div className={cn('h-2 w-2 rounded-full', ocConnected ? 'bg-primary' : 'bg-muted-foreground/20')} />
      </div>

      <nav className="flex flex-col items-center gap-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              cn(
                'grid h-9 w-9 place-items-center rounded-lg transition-colors',
                isActive
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground/60 hover:bg-accent hover:text-foreground',
              )
            }
          >
            <Icon size={18} strokeWidth={1.5} />
          </NavLink>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Theme toggle */}
      <ThemeToggle />

      {/* Settings */}
      <NavLink
        to="/settings"
        title="Settings"
        className={({ isActive }) =>
          cn(
            'grid h-9 w-9 place-items-center rounded-lg transition-colors',
            isActive ? 'bg-accent text-foreground' : 'text-muted-foreground/60 hover:bg-accent hover:text-foreground',
          )
        }
      >
        <Settings size={18} strokeWidth={1.5} />
      </NavLink>

      {version && <p className="mt-2 text-[9px] text-muted-foreground">v{version}</p>}
    </aside>
  )
}

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const Icon = themeIcon[theme]

  return (
    <button
      type="button"
      onClick={() => setTheme(themeNext[theme])}
      title={`Theme: ${theme}`}
      className="mb-1 grid h-9 w-9 place-items-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon size={18} strokeWidth={1.5} />
    </button>
  )
}
