import { useState } from 'react'
import {
  Link2, Bot, ShieldCheck, CalendarClock, Code,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type SettingsSection =
  | 'integrations' | 'jira' | 'gitlab' | 'github' | 'linear' | 'channels' | 'social'
  | 'agent' | 'memories' | 'schedules' | 'tools'
  | 'security' | 'vault' | 'config' | 'tool-config'
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
    children: [
      { id: 'jira', label: 'Jira' },
      { id: 'gitlab', label: 'GitLab' },
      { id: 'github', label: 'GitHub' },
      { id: 'linear', label: 'Linear' },
      { id: 'channels', label: 'Channels' },
      { id: 'social', label: 'Social Media' },
    ],
  },
  {
    id: 'agent',
    label: 'Agent',
    icon: <Bot size={15} />,
    children: [
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
      { id: 'vault', label: 'Vault' },
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
    return group.children?.some(c => c.id === activeSection) ?? false
  }

  const toggleCollapse = (groupId: string) => {
    setCollapsed(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  return (
    <nav className="w-[200px] shrink-0 space-y-1 pr-4 border-r border-white/[0.06] overflow-y-auto">
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
                  ? 'bg-white/[0.08] text-zinc-100'
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
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
                  className="p-0.5 text-zinc-500 hover:text-zinc-300"
                >
                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              )}
            </button>

            {hasChildren && isOpen && (
              <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/[0.06] pl-2">
                {group.children!.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onNavigate(child.id)}
                    className={cn(
                      'flex w-full items-center rounded-md px-2 py-1 text-xs transition-colors',
                      isActive(child.id)
                        ? 'bg-indigo-500/10 text-indigo-400'
                        : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
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
