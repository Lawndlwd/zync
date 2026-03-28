import type { LifeOsStats } from '@zync/shared/types'
import { Brain, Dumbbell, Sparkles } from 'lucide-react'

const bars = [
  { key: 'mental', label: 'MENTAL', icon: Brain, getValue: (s: LifeOsStats) => (s.morningDone ? 88 : 45) },
  {
    key: 'physical',
    label: 'PHYSICAL',
    icon: Dumbbell,
    getValue: (s: LifeOsStats) =>
      Math.min(100, Math.round((s.todayLeversCompleted / Math.max(1, s.todayLeversTotal)) * 100)),
  },
  { key: 'spiritual', label: 'SPIRITUAL', icon: Sparkles, getValue: (s: LifeOsStats) => (s.eveningDone ? 92 : 50) },
] as const

export function PersonalBalance({ stats }: { stats?: LifeOsStats | null }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-display font-semibold text-foreground mb-3">Personal Balance</h3>
      <div className="space-y-4">
        {bars.map(({ key, label, icon: Icon, getValue }) => {
          const pct = stats ? getValue(stats) : 0
          return (
            <div key={key} className="flex items-center gap-3">
              <Icon size={16} className="text-primary shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground w-20">{label}</span>
              <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-[#ff5737] transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-bold text-foreground w-8 text-right">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
