import { Outlet, NavLink, useLocation, Navigate } from 'react-router-dom'
import { LayoutDashboard, Calendar, Lightbulb, PenSquare, Inbox, Settings, Plus, TrendingUp, Loader2 } from 'lucide-react'
import { useSocialFilter } from '../../store/social-filter'
import { getAccounts } from '../../services/social'
import { Suspense, useEffect, useState } from 'react'
import type { SocialAccount, SocialPlatform } from '../../types/social'

const tabs = [
  { to: '/social/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/social/trending', label: 'Trending', icon: TrendingUp },
  { to: '/social/calendar', label: 'Calendar', icon: Calendar },
  { to: '/social/workshop', label: 'Workshop', icon: Lightbulb },
  { to: '/social/create', label: 'Create', icon: PenSquare },
  { to: '/social/inbox', label: 'Inbox', icon: Inbox },
  { to: '/social/settings', label: 'Settings', icon: Settings },
]

const platforms: { value: SocialPlatform | 'all'; label: string }[] = [
  { value: 'all', label: 'All Platforms' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'telegram', label: 'Telegram' },
]

export function SocialLayout() {
  const { platform, accountIds, setPlatform, setAccountIds } = useSocialFilter()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const location = useLocation()

  useEffect(() => {
    getAccounts().then(setAccounts).catch(() => {})
  }, [])

  if (location.pathname === '/social') return <Navigate to="/social/dashboard" replace />

  const filteredAccounts = platform
    ? accounts.filter((a) => a.platform === platform)
    : accounts

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Filter bar + Connect button */}
      <div className="flex items-center gap-3 mb-2 flex-shrink-0">
        <select
          value={platform ?? 'all'}
          onChange={(e) => setPlatform(e.target.value === 'all' ? null : (e.target.value as SocialPlatform))}
          className="bg-zinc-900 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500/30"
        >
          {platforms.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {filteredAccounts.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {filteredAccounts.map((a) => {
              const selected = accountIds.includes(a.id)
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    if (selected) setAccountIds(accountIds.filter((id) => id !== a.id))
                    else setAccountIds([...accountIds, a.id])
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    selected
                      ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30'
                      : 'bg-white/[0.04] text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  @{a.username}
                </button>
              )
            })}
          </div>
        )}

        <NavLink
          to="/social/settings"
          className="ml-auto flex items-center gap-1 text-xs font-medium bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Connect Account
        </NavLink>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-3 flex-shrink-0 border-b border-white/[0.06] pb-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isActive ? 'bg-white/[0.1] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
              }`
            }
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto min-h-0">
        <Suspense fallback={<div className="flex items-center justify-center h-32 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin" /></div>}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  )
}
