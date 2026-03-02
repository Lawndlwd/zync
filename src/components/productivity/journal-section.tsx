import { useState, useCallback } from 'react'
import { MilkdownEditor } from '@/components/ui/milkdown-editor'
import { useJournalStore } from '@/store/journal'
import { useHabitsStore } from '@/store/habits'
import { format, subDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { Calendar } from 'lucide-react'

function formatDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

export function JournalSection() {
  const today = formatDateKey(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const { getOrCreateEntry, updateEntry, getAllDates } = useJournalStore()
  const { getDayNumber, getCompletionsForDate } = useHabitsStore()
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

  return (
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
                {completions.length > 0 && (
                  <span className="text-xs text-zinc-500">
                    {completions.length}
                  </span>
                )}
                {hasEntry && date !== today && completions.length === 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* Main content area */}
      <div className="flex-1">
        <MilkdownEditor
          value={entry.content}
          onChange={handleContentChange}
          placeholder="Start writing..."
          minHeight="60vh"
        />
      </div>
    </div>
  )
}