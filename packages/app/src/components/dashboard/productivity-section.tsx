import { format } from 'date-fns'
import { AlertTriangle, BarChart3, Flame, Target } from 'lucide-react'
import { Cell, Pie, PieChart } from 'recharts'
import { HabitIcon } from '@/components/productivity/habit-icon'
import { useHabitsStore } from '@/store/habits'
import { Section } from './section'

export function ProductivitySection() {
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
  const progressData = [
    { name: 'Done', value: completedToday },
    { name: 'Remaining', value: Math.max(0, habits.length - completedToday) },
  ]
  const trackData = [{ name: 'Track', value: 1 }]

  return (
    <Section
      icon={BarChart3}
      iconColor="text-primary"
      title="Productivity"
      to="/productivity"
      className="col-span-12 lg:col-span-3"
    >
      <div className="flex flex-col items-center gap-6">
        {habits.length > 0 && (
          <div className="rounded-full bg-donut-surface p-3 flex flex-col items-center">
            <div className="relative">
              <PieChart width={180} height={180}>
                {/* Background track */}
                <Pie
                  data={trackData}
                  cx={85}
                  cy={85}
                  innerRadius={78}
                  outerRadius={90}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={false}
                >
                  <Cell fill="rgba(255,255,255,0.15)" />
                </Pie>
                {/* Progress arc */}
                <Pie
                  data={progressData}
                  cx={85}
                  cy={85}
                  innerRadius={62}
                  outerRadius={90}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={10}
                >
                  <Cell fill="#E86B51" />
                  <Cell fill="transparent" />
                </Pie>
              </PieChart>
              <span className="absolute inset-0 flex items-center justify-center text-base font-bold text-white">
                {completionPct}%
              </span>
            </div>
          </div>
        )}
        <div className="flex-1 space-y-3">
          <p className="text-lg font-bold text-foreground">
            {completedToday}/{habits.length} habits today
          </p>
          {topStreak && topStreak.streak > 0 && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Flame size={18} className="text-primary" />
              {topStreak.name} — {topStreak.streak}d streak
            </p>
          )}
          {journey?.active && dayNumber && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Target size={18} className="text-primary" />
              Day {dayNumber} of {journey.name}
              {journey.targetDays && ` (${Math.round((dayNumber / journey.targetDays) * 100)}%)`}
            </p>
          )}
        </div>
      </div>
      {atRisk.length > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-destructive/5 px-4 py-3">
          <AlertTriangle size={20} className="text-destructive shrink-0" />
          <p className="text-sm text-destructive">
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
