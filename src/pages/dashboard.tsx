import { useJiraIssues, useActiveSprint } from '@/hooks/useJiraIssues'
import { useGitlabMRs } from '@/hooks/useGitlab'
import { useTodos } from '@/hooks/useTodos'
import { useMessages } from '@/hooks/useMessages'
import { useBotStatus } from '@/hooks/useBot'
import { useOpenCodeSessions, useAllSessionsTokens } from '@/hooks/useOpenCode'
import { useSettingsStore } from '@/store/settings'
import { useHabitsStore } from '@/store/habits'
import { useJournalStore } from '@/store/journal'
import { useQuery } from '@tanstack/react-query'
import { fetchActivityStats } from '@/services/activity'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { cn, relativeTime } from '@/lib/utils'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import {
  Ticket,
  ListTodo,
  Inbox,
  GitMerge,
  Activity,
  BookOpen,
  BarChart3,
  Bot,
  ArrowRight,
  Circle,
  Flame,
  Target,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Zap,
  MessageSquare,
  Cpu,
  DollarSign,
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
  children,
}: {
  icon: React.ElementType
  iconColor: string
  title: string
  to: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
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

// ── Jira Section ──────────────────────────────────────────────────
function JiraSection() {
  const { data: jiraData, isLoading } = useJiraIssues()
  const boardId = useSettingsStore((s) => s.settings.jira.boardId)
  const { data: sprint } = useActiveSprint(boardId)

  const issues = jiraData?.issues ?? []
  const todo = issues.filter((i) => i.status.category === 'new').length
  const inProgress = issues.filter((i) => i.status.category === 'indeterminate').length
  const done = issues.filter((i) => i.status.category === 'done').length
  const highPriority = issues.filter((i) =>
    ['highest', 'high'].includes(i.priority.name.toLowerCase())
  )

  const pct = issues.length > 0 ? Math.round((done / issues.length) * 100) : 0

  return (
    <Section icon={Ticket} iconColor="text-blue-400" title="Jira" to="/jira">
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </div>
      ) : (
        <>
          {sprint && (
            <div className="mb-4 flex items-center justify-between">
              <span className="text-base font-medium text-indigo-400">{sprint.name}</span>
              {sprint.endDate && (
                <span className="text-sm text-zinc-500">
                  ends {format(new Date(sprint.endDate), 'MMM d')}
                </span>
              )}
            </div>
          )}

          {/* Big numbers */}
          <div className="flex items-center gap-3 mb-5 rounded-lg bg-white/[0.04] py-4">
            <StatBlock label="To Do" value={todo} color="text-zinc-300" />
            <div className="w-px h-8 bg-white/[0.06]" />
            <StatBlock label="In Progress" value={inProgress} color="text-blue-400" />
            <div className="w-px h-8 bg-white/[0.06]" />
            <StatBlock label="Done" value={done} color="text-emerald-400" />
          </div>

          {/* Progress bar */}
          <div className="mb-5">
            <div className="flex justify-between text-base text-zinc-400 mb-2">
              <span>{done}/{issues.length} completed</span>
              <span className="font-semibold">{pct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* High priority issues */}
          {highPriority.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">High Priority</p>
              {highPriority.slice(0, 5).map((issue) => (
                <Link
                  key={issue.key}
                  to="/jira"
                  className="flex items-center gap-3 rounded-lg px-4 py-2.5 hover:bg-white/[0.05] transition-colors"
                >
                  <span className="text-sm font-mono text-zinc-500 shrink-0">{issue.key}</span>
                  <span className="text-base text-zinc-200 truncate">{issue.summary}</span>
                  <span className={cn(
                    'ml-auto shrink-0 rounded-md px-3 py-1 text-sm font-medium',
                    issue.status.category === 'new' && 'bg-white/[0.06] text-zinc-400',
                    issue.status.category === 'indeterminate' && 'bg-blue-500/10 text-blue-400',
                    issue.status.category === 'done' && 'bg-emerald-500/10 text-emerald-400',
                  )}>
                    {issue.status.name}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {issues.length === 0 && (
            <p className="text-base text-zinc-600">No issues in current sprint</p>
          )}
        </>
      )}
    </Section>
  )
}

// ── GitLab Section ────────────────────────────────────────────────
function GitLabSection() {
  const gitlabSettings = useSettingsStore((s) => s.settings.gitlab)
  const projectId = gitlabSettings.defaultProjectId
  const username = gitlabSettings.username

  const { data: toReview } = useGitlabMRs(projectId, username ? { reviewer_username: username, scope: 'all' } : undefined)
  const { data: authored } = useGitlabMRs(projectId, username ? { author_username: username, scope: 'all' } : undefined)

  if (!projectId) {
    return (
      <Section icon={GitMerge} iconColor="text-violet-400" title="GitLab" to="/gitlab">
        <p className="text-base text-zinc-600">Configure a project in settings</p>
      </Section>
    )
  }

  const toReviewCount = toReview?.length ?? 0
  const authoredCount = authored?.length ?? 0
  const withConflicts = authored?.filter((mr) => mr.has_conflicts) ?? []
  const recentMRs = [...(toReview ?? [])].sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  ).slice(0, 5)

  return (
    <Section icon={GitMerge} iconColor="text-violet-400" title="GitLab" to="/gitlab">
      {/* Big numbers */}
      <div className="flex items-center gap-3 mb-5 rounded-lg bg-white/[0.04] py-4">
        <StatBlock label="To Review" value={toReviewCount} color="text-amber-400" />
        <div className="w-px h-8 bg-white/[0.06]" />
        <StatBlock label="My MRs" value={authoredCount} color="text-violet-400" />
        {withConflicts.length > 0 && (
          <>
            <div className="w-px h-8 bg-white/[0.06]" />
            <StatBlock label="Conflicts" value={withConflicts.length} color="text-red-400" />
          </>
        )}
      </div>

      {recentMRs.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Needs Review</p>
          {recentMRs.map((mr) => (
            <Link
              key={mr.id}
              to={`/gitlab/mr/${projectId}/${mr.iid}`}
              className="flex items-center gap-3 rounded-lg px-4 py-2.5 hover:bg-white/[0.05] transition-colors"
            >
              <span className="text-sm font-mono text-zinc-500 shrink-0">!{mr.iid}</span>
              <span className={cn('text-base truncate', mr.draft ? 'text-zinc-500 italic' : 'text-zinc-200')}>
                {mr.draft && 'Draft: '}{mr.title}
              </span>
              {mr.user_notes_count > 0 && (
                <span className="ml-auto flex items-center gap-2 shrink-0 text-sm text-zinc-500">
                  <MessageSquare size={16} /> {mr.user_notes_count}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── Todos Section ─────────────────────────────────────────────────
function TodosSection() {
  const { data: todos = [] } = useTodos()
  const open = todos.filter((t) => t.status === 'open')
  const inProgress = todos.filter((t) => t.status === 'in-progress')
  const done = todos.filter((t) => t.status === 'done')

  const urgent = [...open, ...inProgress].filter((t) => t.priority === 'P1' || t.priority === 'P2')

  return (
    <Section icon={ListTodo} iconColor="text-emerald-400" title="To-Dos" to="/todos">
      {/* Big numbers */}
      <div className="flex items-center gap-3 mb-5 rounded-lg bg-white/[0.04] py-4">
        <StatBlock label="Open" value={open.length} color="text-zinc-300" />
        <div className="w-px h-8 bg-white/[0.06]" />
        <StatBlock label="In Progress" value={inProgress.length} color="text-blue-400" />
        <div className="w-px h-8 bg-white/[0.06]" />
        <StatBlock label="Done" value={done.length} color="text-emerald-400" />
      </div>

      {urgent.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Urgent</p>
          {urgent.slice(0, 5).map((todo) => (
            <div key={todo.id} className="flex items-center gap-3 rounded-lg px-4 py-2.5">
              <span className={cn(
                'shrink-0 rounded-md px-3 py-0.5 text-sm font-bold',
                todo.priority === 'P1' ? 'bg-red-500/10 text-red-400' : 'bg-orange-500/10 text-orange-400'
              )}>
                {todo.priority}
              </span>
              <span className="text-base text-zinc-200 truncate">{todo.title}</span>
              {todo.dueDate && (
                <span className="ml-auto shrink-0 text-sm text-zinc-500">
                  {format(new Date(todo.dueDate), 'MMM d')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {todos.length === 0 && <p className="text-base text-zinc-600">No to-dos yet</p>}
    </Section>
  )
}

// ── Inbox Section ─────────────────────────────────────────────────
function InboxSection() {
  const { data: messages, isLoading } = useMessages()

  const unread = messages?.filter((m) => !m.isRead) ?? []
  const highPriority = unread.filter((m) => m.priority === 'high')
  const total = messages?.length ?? 0

  return (
    <Section icon={Inbox} iconColor="text-sky-400" title="Inbox" to="/inbox">
      {isLoading ? (
        <Skeleton className="h-8 w-full" />
      ) : (
        <>
          {/* Big numbers */}
          <div className="flex items-center gap-3 mb-5 rounded-lg bg-white/[0.04] py-4">
            <StatBlock label="Unread" value={unread.length} color="text-sky-400" />
            <div className="w-px h-8 bg-white/[0.06]" />
            <StatBlock label="Urgent" value={highPriority.length} color="text-red-400" />
            <div className="w-px h-8 bg-white/[0.06]" />
            <StatBlock label="Total" value={total} color="text-zinc-400" />
          </div>

          {unread.length > 0 && (
            <div className="space-y-3">
              {unread.slice(0, 4).map((msg) => (
                <div key={msg.id} className="flex items-center gap-3 rounded-lg px-4 py-2.5">
                  <Circle size={10} className={cn(
                    'shrink-0 fill-current',
                    msg.priority === 'high' ? 'text-red-400' : 'text-sky-400'
                  )} />
                  <span className="text-base font-medium text-zinc-300 shrink-0">{msg.sender}</span>
                  <span className="text-base text-zinc-400 truncate">{msg.content}</span>
                  <span className="ml-auto shrink-0 text-sm text-zinc-600">
                    {relativeTime(msg.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {total === 0 && <p className="text-base text-zinc-600">No messages</p>}
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
    <Section icon={BarChart3} iconColor="text-orange-400" title="Productivity" to="/productivity">
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
function ActivitySection() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['activity-stats', 7],
    queryFn: () => fetchActivityStats(7),
    staleTime: 60_000,
    retry: 1,
  })

  return (
    <Section icon={Activity} iconColor="text-rose-400" title="AI Activity" to="/activity">
      {isLoading ? (
        <Skeleton className="h-8 w-full" />
      ) : stats ? (
        <>
          {/* Big numbers */}
          <div className="flex items-center gap-3 mb-5 rounded-lg bg-white/[0.04] py-4">
            <StatBlock label="Today" value={stats.callsToday} color="text-rose-400" />
            <div className="w-px h-8 bg-white/[0.06]" />
            <StatBlock label="7d Calls" value={stats.totals.total_calls} color="text-zinc-300" />
          </div>

          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-3 text-base text-zinc-400">
              <Zap size={18} className="text-amber-400" />
              {(stats.totals.total_tokens / 1000).toFixed(1)}k tokens
            </div>
            <div className="flex items-center gap-3 text-base text-zinc-400">
              <Clock size={18} className="text-zinc-500" />
              avg {Math.round(stats.totals.avg_duration_ms)}ms
            </div>
          </div>

          {/* Sparkline bars */}
          {stats.byDay.length > 1 && (
            <div className="flex items-end gap-2 h-12">
              {stats.byDay.slice(-7).map((d, i) => {
                const max = Math.max(...stats.byDay.slice(-7).map((x) => x.calls), 1)
                const h = Math.max(6, (d.calls / max) * 48)
                return (
                  <div
                    key={i}
                    className="flex-1 rounded bg-rose-500/30 hover:bg-rose-500/50 transition-colors"
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

// ── Journal Section ───────────────────────────────────────────────
function JournalSection() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const getEntry = useJournalStore((s) => s.getEntry)
  const allDates = useJournalStore((s) => s.getAllDates)()

  const todayEntry = getEntry(today)
  const recentDates = allDates.slice(0, 7)
  const totalEntries = allDates.length

  return (
    <Section icon={BookOpen} iconColor="text-amber-400" title="Journal" to="/journal">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {todayEntry ? (
            <CheckCircle2 size={20} className="text-emerald-400" />
          ) : (
            <Circle size={20} className="text-zinc-600" />
          )}
          <span className="text-base text-zinc-300">
            {todayEntry ? "Today's entry written" : "No entry today"}
          </span>
        </div>
        <span className="text-base text-zinc-500">{totalEntries} entries</span>
      </div>
      {recentDates.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {recentDates.map((date) => (
            <Link
              key={date}
              to="/journal"
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-mono transition-colors',
                date === today
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-white/[0.05] text-zinc-400 hover:bg-white/[0.06]'
              )}
            >
              {format(new Date(date), 'MMM d')}
            </Link>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── Agent Status Section ──────────────────────────────────────────
function AgentSection() {
  const { data: botStatus, isSuccess: connected } = useBotStatus()

  return (
    <Section icon={Bot} iconColor="text-violet-400" title="AI Agent" to="/settings">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <Circle size={12} className={cn(
            'fill-current',
            connected ? 'text-emerald-400' : 'text-zinc-600'
          )} />
          <span className={cn('text-base font-semibold', connected ? 'text-emerald-400' : 'text-zinc-500')}>
            {connected ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
      {connected && botStatus && (
        <div className="flex items-center gap-5 mt-4 text-base text-zinc-400">
          <span><span className="font-semibold text-zinc-200">{botStatus.memoryCount}</span> memories</span>
          <span><span className="font-semibold text-zinc-200">{botStatus.toolCount}</span> tools</span>
          <span><span className="font-semibold text-zinc-200">{botStatus.activeSchedules}</span> schedules</span>
        </div>
      )}
    </Section>
  )
}

// ── OpenCode Section ──────────────────────────────────────────────
function OpenCodeSection() {
  const { data: sessions = [] } = useOpenCodeSessions()
  const tokenStats = useAllSessionsTokens()

  const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }

  return (
    <Section icon={Cpu} iconColor="text-indigo-400" title="OpenCode" to="/opencode">
      <div className="flex items-center gap-3 mb-5 rounded-lg bg-white/[0.04] py-4">
        <StatBlock label="Sessions" value={sessions.length} color="text-indigo-400" />
        <div className="w-px h-8 bg-white/[0.06]" />
        <StatBlock label="Tokens" value={undefined} color="text-zinc-300" />
        <div className="w-px h-8 bg-white/[0.06]" />
        <StatBlock label="Cost" value={undefined} color="text-amber-400" />
      </div>

      {tokenStats.total > 0 && (
        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-3 text-base text-zinc-400">
            <Zap size={18} className="text-indigo-400" />
            {formatTokens(tokenStats.total)} tokens
          </div>
          {tokenStats.cost > 0 && (
            <div className="flex items-center gap-3 text-base text-zinc-400">
              <DollarSign size={18} className="text-amber-400" />
              ${tokenStats.cost.toFixed(4)}
            </div>
          )}
        </div>
      )}

      {tokenStats.models.length > 0 && (
        <div className="flex items-center gap-2 text-base text-zinc-500">
          <Cpu size={16} className="text-zinc-600" />
          {tokenStats.models.slice(0, 2).join(', ')}
        </div>
      )}

      {sessions.length === 0 && (
        <p className="text-base text-zinc-600">No sessions yet</p>
      )}
    </Section>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────
export function DashboardPage() {
  const today = format(new Date(), 'EEEE, MMMM d')

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100">{getGreeting()}</h1>
        <p className="text-base text-zinc-500 mt-1">{today}</p>
      </div>

      <ErrorBoundary>
        <div className="grid gap-5 lg:grid-cols-2">
          <JiraSection />
          <GitLabSection />
          <TodosSection />
          <InboxSection />
          <ProductivitySection />
          <ActivitySection />
          <OpenCodeSection />
          <JournalSection />
          <AgentSection />
        </div>
      </ErrorBoundary>
    </div>
  )
}
