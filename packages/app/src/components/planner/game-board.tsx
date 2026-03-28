import { ErrorBoundary } from '@/components/ui/error-boundary'
import { useDailyLevers, useIdentity, useLifeOsComponents, useLifeOsStats } from '@/hooks/useLifeOs'
import { ActivitySection } from '../dashboard/activity-section'
import { OverviewSection } from '../dashboard/overview-section'
import { ProductivitySection } from '../dashboard/productivity-section'
import { TasksSection } from '../dashboard/tasks-section'
import { TodayStrip } from '../dashboard/today-strip'
import { AutopilotBreakersCard } from './autopilot-breakers-card'
import { ConstraintsCard } from './constraints-card'
import { DailyLeversPanel } from './daily-levers-panel'
import { IdentityDisplay } from './identity-display'
import { MissionCard } from './mission-card'
import { PersonalBalance } from './personal-balance'
import { ProtocolStatus } from './protocol-status'
import { PsyTracker } from './psy-tracker'
import { VisionCard } from './vision-card'
import { WalkingReflectionCard } from './walking-reflection-card'
import { XpBar } from './xp-bar'

export function GameBoard() {
  const { data: components = [] } = useLifeOsComponents()
  const { data: stats } = useLifeOsStats()
  const today = new Date().toISOString().slice(0, 10)
  const { data: levers = [] } = useDailyLevers(today)
  const { data: identity } = useIdentity()
  const antiVision = components.find((c) => c.type === 'anti-vision')
  const vision = components.find((c) => c.type === 'vision')
  const yearGoal = components.find((c) => c.type === 'one-year-goal' && c.isActive)
  const monthProject = components.find((c) => c.type === 'one-month-project' && c.isActive)
  const constraints = components.find((c) => c.type === 'constraints')

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-3">
        <TodayStrip />
        <div className="grid grid-cols-12 gap-5 lg:gap-3">
          <OverviewSection />
          <TasksSection span={'lg:col-span-4'} />
          <ProductivitySection />
          <ActivitySection />
        </div>
        <div className="grid grid-cols-6 lg:grid-cols-12 auto-rows-min gap-3">
          {/* ── Column 1: Level + Growth Rate + Productivity stacked ── */}
          <div className="col-span-6 lg:col-span-3 flex flex-col gap-3">
            <XpBar stats={stats} />
            <PsyTracker />
            <PersonalBalance stats={stats} />
            <IdentityDisplay identity={identity} />
            <ProtocolStatus stats={stats} />
          </div>

          {/* ── Column 2: Mission + Boss Fight (kept as-is) ── */}
          <div className="col-span-6 lg:col-span-5 p-4 space-y-3 rounded-2xl border border-border">
            <MissionCard type="one-year-goal" component={yearGoal} label="1-Year Goal" sublabel="Mission" />
            <MissionCard
              type="one-month-project"
              component={monthProject}
              label="1-Month Project"
              sublabel="Boss Fight"
            />
            <div className="border-t border-border" />
            <AutopilotBreakersCard />
            <div className="border-t border-border" />
          </div>

          {/* ── Row 2: Vision cards ── */}
          <div className="col-span-3 lg:col-span-4 flex flex-col gap-3">
            <VisionCard type="anti-vision" component={antiVision} />
            <VisionCard type="vision" component={vision} />
            <div className="border-t border-border" />
            <WalkingReflectionCard />
            <DailyLeversPanel levers={levers} />
            <ConstraintsCard component={constraints} />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
