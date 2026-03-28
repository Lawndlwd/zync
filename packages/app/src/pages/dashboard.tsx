import { ActivitySection } from '@/components/dashboard/activity-section'
import { OverviewSection } from '@/components/dashboard/overview-section'
import { ProductivitySection } from '@/components/dashboard/productivity-section'
import { SystemSection } from '@/components/dashboard/system-section'
import { TasksSection } from '@/components/dashboard/tasks-section'
import { TodayStrip } from '@/components/dashboard/today-strip'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { useHabitsStore } from '@/store/habits'

export function DashboardPage() {
  const habits = useHabitsStore((s) => s.habits).filter((h) => !h.archived)
  const hasHabits = habits.length > 0

  return (
    <div className="py-6">
      <ErrorBoundary>
        <div className="grid grid-cols-12 gap-5 lg:gap-6">
          <TodayStrip />
          <OverviewSection />
          <TasksSection span={hasHabits ? 'lg:col-span-4' : 'lg:col-span-8'} />
          {hasHabits && <ProductivitySection />}
          <SystemSection />
          <ActivitySection />
        </div>
      </ErrorBoundary>
    </div>
  )
}
