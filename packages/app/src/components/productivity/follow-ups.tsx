import { useHabitsStore } from '@/store/habits'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { AlertTriangle, Circle, CalendarCheck } from 'lucide-react'
import { HabitIcon } from './habit-icon'

export function FollowUps() {
  const { getMissedToday, getAtRiskHabits, getWeeklyScore, toggleHabitForDate, habits, logs } = useHabitsStore()
  const today = format(new Date(), 'yyyy-MM-dd')

  const missed = getMissedToday()
  const atRisk = getAtRiskHabits()
  const weeklyScore = getWeeklyScore()

  const dayOfWeek = new Date().getDay() // 0 = Sunday
  const showWeeklyReview = dayOfWeek === 0 || dayOfWeek === 1 // Sun or Mon

  const completedToday = logs.filter((l) => l.date === today).length

  if (missed.length === 0 && atRisk.length === 0 && !showWeeklyReview) return null

  return (
    <div className="space-y-4">
      {/* Missed habits */}
      {missed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base">
              <Circle size={20} className="text-zinc-500" />
              Missed Today
              <Badge variant="default">{missed.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {missed.map((h) => (
                <Button
                  key={h.id}
                  variant="outline"
                  size="sm"
                  onClick={() => toggleHabitForDate(h.id, today)}
                  className="gap-2"
                >
                  <HabitIcon name={h.icon} size={18} />
                  {h.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Streaks at risk */}
      {atRisk.length > 0 && (
        <Card className="border-amber-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base text-amber-400">
              <AlertTriangle size={20} />
              Streaks at Risk
              <Badge variant="default">{atRisk.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {atRisk.map((h) => (
                <Button
                  key={h.id}
                  variant="outline"
                  size="sm"
                  onClick={() => toggleHabitForDate(h.id, today)}
                  className="gap-2 border-amber-800 hover:bg-amber-900/30"
                >
                  <HabitIcon name={h.icon} size={18} />
                  {h.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly review */}
      {showWeeklyReview && habits.length > 0 && (
        <Card className="border-indigo-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base text-indigo-400">
              <CalendarCheck size={20} />
              Weekly Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base text-zinc-400 mb-2">How was your week?</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-zinc-100">{weeklyScore}%</p>
                <p className="text-sm text-zinc-500">Weekly Score</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-100">{habits.length}</p>
                <p className="text-sm text-zinc-500">Habits Tracked</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-100">{completedToday}/{habits.length}</p>
                <p className="text-sm text-zinc-500">Done Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
