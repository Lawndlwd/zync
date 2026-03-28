import { Bot, CalendarClock, ChevronDown, ChevronRight, Code, Link2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export type SettingsSection =
  | 'integrations'
  | 'agent'
  | 'profile'
  | 'instructions'
  | 'memories'
  | 'schedules'
  | 'tools'
  | 'security'
  | 'config'
  | 'tool-config'
  | 'briefings'
  | 'opencode'

interface SidebarGroup {
  id: SettingsSection
  label: string
  icon: React.ReactNode
  children?: { id: SettingsSection; label: string }[]
}

const groups: SidebarGroup[] = [
  {
    id: 'integrations',
    label: 'Integrations',
    icon: <Link2 size={15} />,
  },
  {
    id: 'agent',
    label: 'Agent',
    icon: <Bot size={15} />,
    children: [
      { id: 'profile', label: 'Profile' },
      { id: 'instructions', label: 'Instructions' },
      { id: 'memories', label: 'Memories' },
      { id: 'schedules', label: 'Schedules' },
      { id: 'tools', label: 'Tools' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    icon: <ShieldCheck size={15} />,
    children: [
      { id: 'config', label: 'Configuration' },
      { id: 'tool-config', label: 'Tool Config' },
    ],
  },
  {
    id: 'briefings',
    label: 'Briefings',
    icon: <CalendarClock size={15} />,
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    icon: <Code size={15} />,
  },
]

interface SettingsSidebarProps {
  activeSection: SettingsSection
  onNavigate: (section: SettingsSection) => void
}

export function SettingsSidebar({ activeSection, onNavigate }: SettingsSidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const isActive = (id: SettingsSection) => activeSection === id
  const isGroupActive = (group: SidebarGroup) => {
    if (activeSection === group.id) return true
    return group.children?.some((c) => c.id === activeSection) ?? false
  }

  const toggleCollapse = (groupId: string) => {
    setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  return (
    <nav className="w-[200px] shrink-0 space-y-1 pr-4 border-r border-border overflow-y-auto">
      {groups.map((group) => {
        const hasChildren = !!group.children?.length
        const isOpen = !collapsed[group.id]
        const groupActive = isGroupActive(group)

        return (
          <div key={group.id}>
            <button
              onClick={() => {
                if (hasChildren) {
                  if (collapsed[group.id]) {
                    toggleCollapse(group.id)
                  }
                  onNavigate(group.id)
                } else {
                  onNavigate(group.id)
                }
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                groupActive
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {group.icon}
              <span className="flex-1 text-left">{group.label}</span>
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleCollapse(group.id)
                  }}
                  className="p-0.5 text-muted-foreground hover:text-foreground"
                >
                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              )}
            </button>

            {hasChildren && isOpen && (
              <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                {group.children!.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onNavigate(child.id)}
                    className={cn(
                      'flex w-full items-center rounded-md px-2 py-1 text-xs transition-colors',
                      isActive(child.id)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
