import type { LifeOsJournalEntry } from '@zync/shared/types'
import { AlertTriangle, BookOpen, ChevronLeft, ChevronRight, Footprints, Moon, Sun } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useJournalEntries } from '@/hooks/useLifeOs'

export function JournalView() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Fetch all entries for the visible month
  const from = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate()
  const to = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${lastDay}`
  const { data: entries = [] } = useJournalEntries({ from, to })

  // Group entries by date
  const entryMap = useMemo(() => {
    const map: Record<string, LifeOsJournalEntry[]> = {}
    for (const e of entries) {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    }
    return map
  }, [entries])

  const selectedEntries = selectedDate ? entryMap[selectedDate] || [] : []
  const morningEntry = selectedEntries.find((e) => e.type === 'morning')
  const eveningEntry = selectedEntries.find((e) => e.type === 'evening')
  const breakerEntries = selectedEntries.filter((e) => e.type === 'breaker')
  const walkingEntries = selectedEntries.filter((e) => e.type === 'walking')

  // Calendar grid
  const firstDayOfMonth = new Date(currentMonth.year, currentMonth.month, 1).getDay()
  // Adjust for Monday start (0=Mon, 6=Sun)
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
  const daysInMonth = lastDay
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const today = new Date().toISOString().slice(0, 10)

  const prevMonth = () => {
    setCurrentMonth((prev) =>
      prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 },
    )
    setSelectedDate(null)
  }

  const nextMonth = () => {
    setCurrentMonth((prev) =>
      prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 },
    )
    setSelectedDate(null)
  }

  const dateStr = (day: number) =>
    `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BookOpen size={20} className="text-primary" />
        <h2 className="text-lg font-bold text-foreground">Journal</h2>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Calendar */}
        <Card className="gap-0 bg-card border border-border py-0">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth} aria-label="Previous month">
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm font-medium text-foreground">{monthLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth} aria-label="Next month">
                <ChevronRight size={16} />
              </Button>
            </div>

            {/* Day headers */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                <div key={d} className="text-center text-[10px] font-medium uppercase text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for offset */}
              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {days.map((day) => {
                const ds = dateStr(day)
                const dayEntries = entryMap[ds] || []
                const hasMorning = dayEntries.some((e) => e.type === 'morning' && e.completedAt)
                const hasEvening = dayEntries.some((e) => e.type === 'evening' && e.completedAt)
                const hasBreaker = dayEntries.some((e) => e.type === 'breaker')
                const hasWalking = dayEntries.some((e) => e.type === 'walking')
                const isSelected = ds === selectedDate
                const isToday = ds === today

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(ds)}
                    className={`relative flex h-10 flex-col items-center justify-center rounded-lg text-sm transition-colors ${
                      isSelected
                        ? 'bg-primary/20 text-primary'
                        : isToday
                          ? 'bg-accent text-foreground'
                          : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {day}
                    {(hasMorning || hasEvening || hasBreaker || hasWalking) && (
                      <div className="flex gap-0.5">
                        {hasMorning && <div className="h-1 w-1 rounded-full bg-primary" />}
                        {hasEvening && <div className="h-1 w-1 rounded-full bg-muted-foreground" />}
                        {hasBreaker && <div className="h-1 w-1 rounded-full bg-primary/60" />}
                        {hasWalking && <div className="h-1 w-1 rounded-full bg-muted-foreground/60" />}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Day Detail */}
        <div className="space-y-4">
          {selectedDate ? (
            <>
              <p className="text-sm text-muted-foreground">
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>

              {morningEntry ? (
                <Card className="gap-0 border-primary/10 bg-primary/[0.02] py-0">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Sun size={16} className="text-primary" />
                      <span className="text-sm font-medium text-primary">Morning Protocol</span>
                    </div>
                    <div className="space-y-3">
                      {morningEntry.responses.map((r, i) => (
                        <div key={i}>
                          <p className="text-xs text-muted-foreground">{r.question}</p>
                          <p className="mt-0.5 text-sm text-foreground">{r.answer || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="gap-0 border-border py-0">
                  <CardContent className="p-5 text-center text-sm text-muted-foreground">
                    No morning protocol for this day
                  </CardContent>
                </Card>
              )}

              {eveningEntry ? (
                <Card className="gap-0 border-border bg-secondary py-0">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Moon size={16} className="text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Evening Synthesis</span>
                    </div>
                    <div className="space-y-3">
                      {eveningEntry.responses.map((r, i) => (
                        <div key={i}>
                          <p className="text-xs text-muted-foreground">{r.question}</p>
                          <p className="mt-0.5 text-sm text-foreground">{r.answer || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="gap-0 border-border py-0">
                  <CardContent className="p-5 text-center text-sm text-muted-foreground">
                    No evening synthesis for this day
                  </CardContent>
                </Card>
              )}

              {breakerEntries.length > 0 && (
                <Card className="gap-0 border-primary/10 bg-primary/[0.02] py-0">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <AlertTriangle size={16} className="text-primary" />
                      <span className="text-sm font-medium text-primary">Autopilot Breaker Reflections</span>
                    </div>
                    <div className="space-y-3">
                      {breakerEntries
                        .flatMap((e) => e.responses)
                        .map((r, i) => (
                          <div key={i}>
                            <p className="text-xs text-muted-foreground">{r.question}</p>
                            <p className="mt-0.5 text-sm text-foreground">{r.answer || '—'}</p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {walkingEntries.length > 0 && (
                <Card className="gap-0 border-border bg-secondary py-0">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Footprints size={16} className="text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Walking Reflections</span>
                    </div>
                    <div className="space-y-3">
                      {walkingEntries
                        .flatMap((e) => e.responses)
                        .map((r, i) => (
                          <div key={i}>
                            <p className="text-xs text-muted-foreground">{r.question}</p>
                            <p className="mt-0.5 text-sm text-foreground">{r.answer || '—'}</p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="gap-0 border-border py-0">
              <CardContent className="flex flex-col items-center justify-center p-10 text-center">
                <BookOpen size={32} className="mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Select a day to view journal entries</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
