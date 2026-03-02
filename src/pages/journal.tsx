import { useState, useEffect, useCallback } from 'react'
import { useJournalStore } from '@/store/journal'
import { useHabitsStore } from '@/store/habits'
import { useTodos } from '@/hooks/useTodos'
import { MilkdownEditor } from '@/components/ui/milkdown-editor'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Link } from 'react-router-dom'
import { useChatStore } from '@/store/chat'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { format, subDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { Bot, Calendar, Maximize2, Minimize2, Flame, CheckCircle2, ListTodo, BookOpen, Target } from 'lucide-react'
import { HabitIcon } from '@/components/productivity/habit-icon'

function formatDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function JournalOverview({
  selectedDate,
  onSwitchTab,
}: {
  selectedDate: string
  onSwitchTab: (tab: string) => void
}) {
  const { habits, logs, journey, getStreak, setJourney, clearJourney, toggleHabitForDate, getDayNumber } = useHabitsStore()
  const { data: todos = [] } = useTodos()
  const { getOrCreateEntry } = useJournalStore()
  const entry = getOrCreateEntry(selectedDate)

  const openTodos = todos.filter((t) => t.status !== 'done')
  const completedToday = logs.filter((l) => l.date === selectedDate)
  const dayNumber = getDayNumber(selectedDate)

  // Journey form state
  const [showJourneyForm, setShowJourneyForm] = useState(false)
  const [jName, setJName] = useState('')
  const [jStart, setJStart] = useState(formatDateKey(new Date()))
  const [jTarget, setJTarget] = useState('')

  const handleSetJourney = () => {
    if (!jName.trim()) return
    setJourney({
      name: jName.trim(),
      startDate: jStart,
      targetDays: jTarget ? parseInt(jTarget) : null,
      active: true,
    })
    setShowJourneyForm(false)
    setJName('')
    setJTarget('')
  }

  // Get snippet from journal entry (markdown string)
  const getSnippet = () => {
    if (!entry?.content || typeof entry.content !== 'string') return null
    // Strip markdown headings and trim
    const text = entry.content
      .replace(/^#{1,6}\s+.*$/gm, '')
      .replace(/\n{2,}/g, ' ')
      .trim()
    if (!text) return null
    return text.length > 120 ? text.slice(0, 120) + '...' : text
  }

  const snippet = getSnippet()

  return (
    <div className="space-y-4">
      {/* Day counter / Journey */}
      <Card className="p-4">
        {journey?.active ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Target size={20} className="text-indigo-400" />
                <span className="text-base font-medium text-zinc-200">
                  Day {dayNumber || '—'} of {journey.name}
                </span>
              </div>
              <Button variant="ghost" size="sm" className="text-sm text-zinc-500" onClick={clearJourney}>
                End
              </Button>
            </div>
            {journey.targetDays && dayNumber && (
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (dayNumber / journey.targetDays) * 100)}%` }}
                />
              </div>
            )}
          </div>
        ) : showJourneyForm ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400 font-medium">Start a Journey</p>
            <Input placeholder="Journey name" value={jName} onChange={(e) => setJName(e.target.value)} />
            <div className="flex gap-3">
              <Input type="date" value={jStart} onChange={(e) => setJStart(e.target.value)} className="flex-1" />
              <Input
                type="number"
                placeholder="Target days (optional)"
                value={jTarget}
                onChange={(e) => setJTarget(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex gap-3">
              <Button size="sm" onClick={handleSetJourney} disabled={!jName.trim()}>Start</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowJourneyForm(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowJourneyForm(true)}
            className="flex items-center gap-3 text-base text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Target size={18} />
            Set a Journey...
          </button>
        )}
      </Card>

      {/* Today's habits */}
      {habits.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-zinc-400">
              Habits — {completedToday.length}/{habits.length}
            </p>
            <Link to="/productivity" className="text-sm text-indigo-400 hover:text-indigo-300">
              Manage habits
            </Link>
          </div>
          <div className="space-y-3">
            {habits.map((habit) => {
              const done = logs.some((l) => l.habitId === habit.id && l.date === selectedDate)
              const streak = getStreak(habit.id)
              return (
                <button
                  key={habit.id}
                  onClick={() => toggleHabitForDate(habit.id, selectedDate)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-base transition-colors hover:bg-white/[0.05]"
                >
                  <span className={cn(
                    'flex h-7 w-7 items-center justify-center rounded border text-sm',
                    done ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400' : 'border-white/[0.1]'
                  )}>
                    {done && <CheckCircle2 size={16} />}
                  </span>
                  <HabitIcon name={habit.icon} size={18} />
                  <span className={cn('text-base', done ? 'text-zinc-400 line-through' : 'text-zinc-200')}>
                    {habit.name}
                  </span>
                  {streak > 0 && (
                    <span className="ml-auto flex items-center gap-2 text-amber-400 text-sm">
                      <Flame size={14} /> {streak}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* Tasks summary */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ListTodo size={18} className="text-amber-400" />
            <span className="text-base text-zinc-300">{openTodos.length} open to-dos</span>
          </div>
          <a href="/todos" className="text-sm text-indigo-400 hover:text-indigo-300">View all</a>
        </div>
      </Card>

      {/* Journal snippet */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen size={18} className="text-indigo-400" />
          <span className="text-sm font-medium text-zinc-400">Journal</span>
        </div>
        {snippet ? (
          <p className="text-base text-zinc-400 line-clamp-2">{snippet}</p>
        ) : (
          <button
            onClick={() => onSwitchTab('journal')}
            className="text-base text-zinc-500 hover:text-indigo-400 transition-colors"
          >
            Start writing...
          </button>
        )}
      </Card>
    </div>
  )
}

export function JournalPage() {
  const today = formatDateKey(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [fullscreen, setFullscreen] = useState(false)
  const journalTabs = ['overview', 'journal'] as const
  const urlTab = new URLSearchParams(window.location.search).get('tab')
  const [activeTab, setActiveTabState] = useState(
    urlTab && (journalTabs as readonly string[]).includes(urlTab) ? urlTab : 'overview'
  )
  const setActiveTab = (t: string) => {
    setActiveTabState(t)
    const params = new URLSearchParams(window.location.search)
    params.set('tab', t)
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`)
  }
  const { getOrCreateEntry, updateEntry, getAllDates } = useJournalStore()
  const { habits, getDayNumber, getCompletionsForDate } = useHabitsStore()
  const openChat = useChatStore((s) => s.openChat)
  const addMessage = useChatStore((s) => s.addMessage)

  const entry = getOrCreateEntry(selectedDate)
  const dates = getAllDates()

  const recentDates = Array.from({ length: 14 }, (_, i) => formatDateKey(subDays(new Date(), i)))
  const allDates = [...new Set([...recentDates, ...dates])].sort().reverse()

  const handleContentChange = useCallback(
    (markdown: string) => {
      updateEntry(selectedDate, markdown)
    },
    [selectedDate, updateEntry]
  )

  const handleFillFocus = useCallback(() => {
    openChat()
    addMessage(
      'user',
      `Based on my open Jira issues, suggest what I should focus on today. Format it as a short bullet list.`
    )
  }, [openChat, addMessage])

  const handleStandup = useCallback(() => {
    openChat()
    addMessage(
      'user',
      `Generate a standup update based on my Jira issue transitions and what I worked on. Format: What I did yesterday, what I'm doing today, any blockers.`
    )
  }, [openChat, addMessage])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setFullscreen((f) => !f)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className={cn(fullscreen ? 'fixed inset-0 z-50 bg-black/20 p-6' : '')}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Journal</h1>
          <p className="text-base text-zinc-500">{format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'journal' && (
            <>
              <Button variant="secondary" size="sm" onClick={handleFillFocus}>
                <Bot size={18} />
                Fill Focus
              </Button>
              <Button variant="secondary" size="sm" onClick={handleStandup}>
                <Bot size={18} />
                Standup
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={() => setFullscreen((f) => !f)}>
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Date sidebar */}
        <div className="w-48 shrink-0 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
          {allDates.map((date) => {
            const hasEntry = dates.includes(date)
            const completions = getCompletionsForDate(date)
            const dayNum = getDayNumber(date)
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-4 py-2 text-left text-base transition-colors',
                  selectedDate === date
                    ? 'bg-white/[0.08] text-zinc-100'
                    : 'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300'
                )}
              >
                <Calendar size={16} />
                <span>{format(new Date(date), 'MMM d')}</span>
                <span className="ml-auto flex items-center gap-2">
                  {dayNum && (
                    <span className="text-xs text-indigo-400">D{dayNum}</span>
                  )}
                  {habits.length > 0 && completions.length > 0 && (
                    <span className="text-xs text-zinc-500">
                      {completions.length}/{habits.length}
                    </span>
                  )}
                  {date === today && !dayNum && (
                    <span className="text-xs text-indigo-400">Today</span>
                  )}
                  {hasEntry && date !== today && !dayNum && completions.length === 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {/* Main content area */}
        <div className="flex-1">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="journal">Journal</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <JournalOverview selectedDate={selectedDate} onSwitchTab={setActiveTab} />
            </TabsContent>

            <TabsContent value="journal">
              <ErrorBoundary>
                <MilkdownEditor
                  value={entry.content}
                  onChange={handleContentChange}
                  placeholder="Start writing..."
                  minHeight="60vh"
                />
              </ErrorBoundary>
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </div>
  )
}
