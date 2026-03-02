import { useState } from 'react'
import { MetricsRow } from '@/components/productivity/metrics-row'
import { CompletionChart } from '@/components/productivity/completion-chart'
import { Heatmap } from '@/components/productivity/heatmap'
import { HabitBreakdown } from '@/components/productivity/habit-breakdown'
import { FollowUps } from '@/components/productivity/follow-ups'
import { HabitCreator } from '@/components/productivity/habit-creator'
import { HabitCard } from '@/components/productivity/habit-card'
import { JournalSection } from '@/components/productivity/journal-section'
import { useHabitsStore } from '@/store/habits'
import { BarChart3, ChevronDown, ChevronUp, Archive } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProductivityPage() {
  const habits = useHabitsStore((s) => s.habits)
  const activeHabits = habits.filter((h) => !h.archived)
  const archivedHabits = habits.filter((h) => h.archived)
  const [showArchived, setShowArchived] = useState(false)
  const [activeTab, setActiveTab] = useState('habits')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Productivity</h1>
        <p className="text-base text-zinc-500">Track your habits, streaks, and progress</p>
      </div>

      {/* Add tab navigation */}
      <div className="mb-4 border-b border-white/[0.06]">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('habits')}
            className={cn(
              'pb-2 text-sm font-medium transition-colors',
              activeTab === 'habits' 
                ? 'border-b-2 border-indigo-400 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            Habits
          </button>
          <button
            onClick={() => setActiveTab('journal')}
            className={cn(
              'pb-2 text-sm font-medium transition-colors',
              activeTab === 'journal'
                ? 'border-b-2 border-indigo-400 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            Journal
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'habits' ? (
        <div className="space-y-6">
          {/* Habit Creator */}
          <HabitCreator defaultExpanded={activeHabits.length === 0} />

          {/* Active Habits */}
          {activeHabits.length > 0 && (
            <div>
              <p className="text-sm font-medium text-zinc-500 mb-3">Active Habits</p>
              <div className="space-y-3">
                {activeHabits.map((h) => (
                  <HabitCard key={h.id} habit={h} />
                ))}
              </div>
            </div>
          )}

          {activeHabits.length > 0 && (
            <>
              <MetricsRow />

              <div className="grid gap-6 lg:grid-cols-2">
                <CompletionChart />
                <Heatmap />
              </div>

              <HabitBreakdown />

              <FollowUps />
            </>
          )}

          {activeHabits.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] py-16 text-center">
              <BarChart3 size={40} className="text-zinc-600 mb-3" />
              <p className="text-zinc-400 mb-1">No active habits yet</p>
              <p className="text-base text-zinc-500">
                Create a habit above to start tracking your productivity.
              </p>
            </div>
          )}

          {/* Archived Habits */}
          {archivedHabits.length > 0 && (
            <div>
              <button
                onClick={() => setShowArchived((s) => !s)}
                className="flex items-center gap-3 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors mb-3"
              >
                <Archive size={16} />
                Archived ({archivedHabits.length})
                {showArchived ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showArchived && (
                <div className="space-y-3">
                  {archivedHabits.map((h) => (
                    <HabitCard key={h.id} habit={h} variant="archived" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <JournalSection />
      )}
    </div>
  )
}
