import { useState } from 'react'
import { useAllTasks } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { useBotStatus, useBotChannels, useBriefingConfig } from '@/hooks/useBot'
import { useHabitsStore } from '@/store/habits'
import { useJournalStore } from '@/store/journal'
import { useQuery } from '@tanstack/react-query'
import { fetchActivityStats } from '@/services/activity'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import {
  KanbanSquare,
  Activity,
  BarChart3,
  Bot,
  ArrowRight,
  Circle,
  Flame,
  Target,
  AlertTriangle,
  Clock,
  Zap,
  CheckCircle2,
  DollarSign,
  Settings,
} from 'lucide-react'
import { HabitIcon } from '@/components/productivity/habit-icon'
import { PieChart, Pie, Cell } from 'recharts'

// ── Greeting ──────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// ── Section wrapper ───────────────────────────────────────────────
function Section({
  icon: Icon,
  iconColor,
  title,
  to,
  className,
  children,
}: {
  icon: React.ElementType
  iconColor: string
  title: string
  to: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden', className)}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <Icon size={24} className={iconColor} />
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        </div>
        <Link to={to} className="flex items-center gap-2 text-base text-zinc-500 hover:text-zinc-300 transition-colors">
          View all <ArrowRight size={18} />
        </Link>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  )
}

// ── Big stat block ────────────────────────────────────────────────
function StatBlock({ label, value, color }: { label: string; value: number | undefined; color: string }) {
  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      {value === undefined ? (
        <Skeleton className="h-8 w-10" />
      ) : (
        <span className={cn('text-2xl font-bold', color)}>{value}</span>
      )}
      <span className="text-sm text-zinc-500">{label}</span>
    </div>
  )
}

// ── Cron helper ───────────────────────────────────────────────────
function cronToTime(cron: string): string | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return null
  const minute = parseInt(parts[0], 10)
  const hour = parseInt(parts[1], 10)
  if (isNaN(minute) || isNaN(hour)) return null
  const h = hour % 12 || 12
  const ampm = hour < 12 ? 'AM' : 'PM'
  return `${h}:${String(minute).padStart(2, '0')} ${ampm}`
}

// ── Today Strip ──────────────────────────────────────────────────
function TodayStrip() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const journalEntry = useJournalStore((s) => s.getEntry(today))
  const { data: briefingConfig } = useBriefingConfig()
  const { isSuccess: connected } = useBotStatus()
  const { data: channels } = useBotChannels()
  const { data: stats } = useQuery({
    queryKey: ['activity-stats', 1],
    queryFn: () => fetchActivityStats(1),
    staleTime: 60_000,
    retry: 1,
  })

  const onlineChannels = channels?.filter((ch) => ch.connected) ?? []

  const nextBriefing = briefingConfig?.enabled
    ? cronToTime(briefingConfig.morningCron) ?? cronToTime(briefingConfig.eveningCron)
    : null

  return (
    <div className="col-span-4 lg:col-span-12 rounded-xl border border-white/[0.06] bg-white/[0.03] py-3 px-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {/* Journal */}
        <div className="flex items-center gap-2 text-sm">
          {journalEntry ? (
            <>
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span className="text-zinc-300">Entry written</span>
            </>
          ) : (
            <>
              <Circle size={16} className="text-zinc-600" />
              <span className="text-zinc-500">No entry yet</span>
            </>
          )}
        </div>

        <div className="w-px h-4 bg-white/[0.08] hidden sm:block" />

        {/* Briefing */}
        <div className="flex items-center gap-2 text-sm">
          <Clock size={16} className="text-zinc-500" />
          <span className="text-zinc-400">
            {nextBriefing ? `Next briefing ${nextBriefing}` : 'Briefings off'}
          </span>
        </div>

        <div className="w-px h-4 bg-white/[0.08] hidden sm:block" />

        {/* LLM cost */}
        <div className="flex items-center gap-2 text-sm">
          <DollarSign size={16} className="text-zinc-500" />
          <span className="text-zinc-400">
            ${stats?.totals.total_cost?.toFixed(2) ?? '0.00'} today
          </span>
        </div>

        <div className="w-px h-4 bg-white/[0.08] hidden sm:block" />

        {/* Calls today */}
        <div className="flex items-center gap-2 text-sm">
          <Zap size={16} className="text-amber-400" />
          <span className="text-zinc-400">{stats?.callsToday ?? 0} calls</span>
        </div>

        <div className="w-px h-4 bg-white/[0.08] hidden sm:block" />

        {/* Agent status */}
        <div className="flex items-center gap-2 text-sm">
          <Circle size={10} className={cn(
            'fill-current',
            connected ? 'text-emerald-400' : 'text-zinc-600'
          )} />
          <span className={cn(connected ? 'text-emerald-400' : 'text-zinc-500')}>
            {connected ? 'Online' : 'Offline'}
          </span>
          {onlineChannels.map((ch) => (
            <span key={ch.channel} className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-400 capitalize">
              {ch.channel}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tasks Section ─────────────────────────────────────────────────
function TasksSection({ span }: { span?: string }) {
  const { data: allTasks = [], isLoading } = useAllTasks()
  const { data: projects = [] } = useProjects()

  const todo = allTasks.filter((t) => t.metadata.status === 'todo').length
  const inProgress = allTasks.filter((t) => t.metadata.status === 'in-progress').length
  const done = allTasks.filter((t) => t.metadata.status === 'completed').length
  const highPriority = allTasks.filter((t) => t.metadata.priority === 'high')

  return (
    <Section icon={KanbanSquare} iconColor="text-emerald-400" title="Tasks & Projects" to="/tasks" className={cn('col-span-4', span ?? 'lg:col-span-4')}>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-5 rounded-lg bg-white/[0.04] py-4">
            <StatBlock label="To Do" value={todo} color="text-zinc-300" />
            <div className="w-px h-8 bg-white/[0.06]" />
            <StatBlock label="In Progress" value={inProgress} color="text-blue-400" />
            <div className="w-px h-8 bg-white/[0.06]" />
            <StatBlock label="Done" value={done} color="text-emerald-400" />
          </div>

          {projects.length > 0 && (
            <div className="mb-4 flex items-center gap-2 text-sm text-zinc-500">
              <span className="font-semibold text-zinc-200">{projects.length}</span> project{projects.length !== 1 ? 's' : ''}
            </div>
          )}

          {highPriority.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">High Priority</p>
              {highPriority.slice(0, 5).map((task) => (
                <Link
                  key={`${task.project}/${task.fileName}`}
                  to={`/tasks?task=${task.project}/${task.fileName}`}
                  className="flex items-center gap-3 rounded-lg px-4 py-2.5 hover:bg-white/[0.05] transition-colors"
                >
                  <span className="text-sm font-mono text-zinc-500 shrink-0">{task.project}</span>
                  <span className="text-base text-zinc-200 truncate">{task.metadata.title}</span>
                  <span className={cn(
                    'ml-auto shrink-0 rounded-md px-3 py-1 text-sm font-medium',
                    task.metadata.status === 'todo' && 'bg-white/[0.06] text-zinc-400',
                    task.metadata.status === 'in-progress' && 'bg-blue-500/10 text-blue-400',
                    task.metadata.status === 'completed' && 'bg-emerald-500/10 text-emerald-400',
                  )}>
                    {task.metadata.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {allTasks.length === 0 && (
            <p className="text-base text-zinc-600">No tasks yet</p>
          )}
        </>
      )}
    </Section>
  )
}

// ── Productivity Section ──────────────────────────────────────────
function ProductivitySection() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { logs, journey, getStreak, getAtRiskHabits, getDayNumber } = useHabitsStore()
  const habits = useHabitsStore((s) => s.habits).filter((h) => !h.archived)

  const completedToday = logs.filter((l) => l.date === today).length
  const dayNumber = getDayNumber(today)
  const atRisk = getAtRiskHabits()

  const topStreak = habits.reduce<{ name: string; streak: number; icon: string } | null>((best, h) => {
    const s = getStreak(h.id)
    if (!best || s > best.streak) return { name: h.name, streak: s, icon: h.icon }
    return best
  }, null)

  if (habits.length === 0 && !journey?.active) return null

  const completionPct = habits.length > 0 ? Math.round((completedToday / habits.length) * 100) : 0
  const donutData = [
    { name: 'Done', value: completedToday },
    { name: 'Remaining', value: Math.max(0, habits.length - completedToday) },
  ]

  return (
    <Section icon={BarChart3} iconColor="text-orange-400" title="Productivity" to="/productivity" className="col-span-4 lg:col-span-4">
      <div className="flex items-center gap-6">
        {/* Donut */}
        {habits.length > 0 && (
          <div className="relative h-20 w-20 shrink-0">
            <PieChart width={80} height={80}>
              <Pie
                data={donutData}
                cx={36} cy={36}
                innerRadius={24} outerRadius={36}
                startAngle={90} endAngle={-270}
                dataKey="value" stroke="none"
              >
                <Cell fill="#6366f1" />
                <Cell fill="#27272a" />
              </Pie>
            </PieChart>
            <span className="absolute inset-0 flex items-center justify-center text-base font-bold text-zinc-100">
              {completionPct}%
            </span>
          </div>
        )}
        <div className="flex-1 space-y-3">
          <p className="text-lg font-bold text-zinc-100">
            {completedToday}/{habits.length} habits today
          </p>
          {topStreak && topStreak.streak > 0 && (
            <p className="text-base text-zinc-400 flex items-center gap-2">
              <Flame size={18} className="text-amber-400" />
              {topStreak.name} — {topStreak.streak}d streak
            </p>
          )}
          {journey?.active && dayNumber && (
            <p className="text-base text-zinc-400 flex items-center gap-2">
              <Target size={18} className="text-indigo-400" />
              Day {dayNumber} of {journey.name}
              {journey.targetDays && ` (${Math.round((dayNumber / journey.targetDays) * 100)}%)`}
            </p>
          )}
        </div>
      </div>
      {atRisk.length > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-amber-500/5 border border-amber-500/10 px-4 py-3">
          <AlertTriangle size={20} className="text-amber-400 shrink-0" />
          <p className="text-base text-amber-300">
            {atRisk.length} streak{atRisk.length > 1 ? 's' : ''} at risk:{' '}
            {atRisk.map((h, i) => (
              <span key={h.id} className="inline-flex items-center gap-2">
                {i > 0 && ', '}
                <HabitIcon name={h.icon} size={18} />
                {h.name}
              </span>
            ))}
          </p>
        </div>
      )}
    </Section>
  )
}

// ── Activity Section ──────────────────────────────────────────────
const periodOptions = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: 9999 },
] as const

function ActivitySection({ span }: { span?: string }) {
  const [days, setDays] = useState(7)
  const periodLabel = periodOptions.find((p) => p.days === days)?.label ?? `${days}d`

  const { data: stats, isLoading } = useQuery({
    queryKey: ['activity-stats', days],
    queryFn: () => fetchActivityStats(days),
    staleTime: 60_000,
    retry: 1,
  })

  const barData = days <= 90 ? stats?.byDay : stats?.byDay.slice(-90)

  return (
    <Section icon={Activity} iconColor="text-rose-400" title="AI Activity" to="/activity" className={cn('col-span-4', span ?? 'lg:col-span-4')}>
      {/* Period selector */}
      <div className="flex gap-1 mb-3">
        {periodOptions.map((p) => (
          <button
            key={p.days}
            onClick={() => setDays(p.days)}
            className={cn(
              'px-2.5 py-0.5 text-xs rounded-full transition-colors',
              days === p.days
                ? 'bg-rose-500/20 text-rose-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-8 w-full" />
      ) : stats ? (
        <>
          {/* Big numbers */}
          <div className="flex items-center gap-3 mb-5 rounded-lg bg-white/[0.04] py-4">
            <StatBlock label="Today" value={stats.callsToday} color="text-rose-400" />
            <div className="w-px h-8 bg-white/[0.06]" />
            <StatBlock label={`${periodLabel} Calls`} value={stats.totals.total_calls} color="text-zinc-300" />
            <div className="w-px h-8 bg-white/[0.06]" />
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="text-2xl font-bold text-zinc-300">${stats.totals.total_cost?.toFixed(2) ?? '0'}</span>
              <span className="text-sm text-zinc-500">{periodLabel} Cost</span>
            </div>
          </div>

          {/* Sparkline bars */}
          {barData && barData.length > 1 && (
            <div className="flex items-end gap-px h-12">
              {barData.map((d, i) => {
                const max = Math.max(...barData.map((x) => x.calls), 1)
                const h = Math.max(4, (d.calls / max) * 48)
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-rose-500/30 hover:bg-rose-500/50 transition-colors"
                    style={{ height: `${h}px` }}
                    title={`${d.day}: ${d.calls} calls`}
                  />
                )
              })}
            </div>
          )}
        </>
      ) : (
        <p className="text-base text-zinc-600">No activity data</p>
      )}
    </Section>
  )
}

// ── System Section (Agent details, full-width) ───────────────────
function SystemSection() {
  const { data: botStatus, isSuccess: connected } = useBotStatus()
  const { data: channels } = useBotChannels()

  const onlineChannels = channels?.filter((ch) => ch.connected) ?? []

  return (
    <div className="col-span-4 lg:col-span-12 rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <Bot size={24} className="text-violet-400" />
          <h2 className="text-base font-semibold text-zinc-100">Agent & System</h2>
        </div>
        <Link to="/settings" className="flex items-center gap-2 text-base text-zinc-500 hover:text-zinc-300 transition-colors">
          <Settings size={18} />
        </Link>
      </div>
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          {/* Status + model */}
          <div className="flex items-center gap-3">
            <Circle size={12} className={cn(
              'fill-current',
              connected ? 'text-emerald-400' : 'text-zinc-600'
            )} />
            <span className={cn('text-base font-semibold', connected ? 'text-emerald-400' : 'text-zinc-500')}>
              {connected ? 'Online' : 'Offline'}
            </span>
            {connected && botStatus?.modelName && (
              <span className="text-sm text-zinc-500">{botStatus.modelName}</span>
            )}
          </div>

          {/* Stats */}
          {connected && botStatus && (
            <div className="flex items-center gap-5 text-base text-zinc-400">
              <span><span className="font-semibold text-zinc-200">{botStatus.memoryCount}</span> memories</span>
              <span><span className="font-semibold text-zinc-200">{botStatus.toolCount}</span> tools</span>
              <span><span className="font-semibold text-zinc-200">{botStatus.activeSchedules}</span> schedules</span>
            </div>
          )}

          {/* Channel badges */}
          {onlineChannels.length > 0 && (
            <div className="flex items-center gap-2">
              {onlineChannels.map((ch) => (
                <span key={ch.channel} className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 capitalize">
                  {ch.channel}
                </span>
              ))}
            </div>
          )}

          {/* Links */}
          {connected && (
            <div className="flex items-center gap-3 ml-auto">
              <Link to="/canvas" className="text-sm text-pink-400 hover:text-pink-300 transition-colors">
                Canvas
              </Link>
              <span className="text-zinc-700">·</span>
              <Link to="/settings" className="text-sm text-zinc-400 hover:text-zinc-300 transition-colors">
                Settings
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────
export function DashboardPage() {
  const today = format(new Date(), 'EEEE, MMMM d')
  const habits = useHabitsStore((s) => s.habits).filter((h) => !h.archived)
  const hasHabits = habits.length > 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100">{getGreeting()}</h1>
        <p className="text-base text-zinc-500 mt-1">{today}</p>
      </div>

      <ErrorBoundary>
        <div className="grid grid-cols-4 gap-5 lg:grid-cols-12">
          {/* Row 1 — Today Strip */}
          <TodayStrip />

          {/* Row 2 — Tasks / Productivity / Activity */}
          <TasksSection span={hasHabits ? 'lg:col-span-4' : 'lg:col-span-6'} />
          {hasHabits && <ProductivitySection />}
          <ActivitySection span={hasHabits ? 'lg:col-span-4' : 'lg:col-span-6'} />

          {/* Row 4 — Agent & System */}
          <SystemSection />
        </div>
      </ErrorBoundary>
    </div>
  )
}
