import { useState } from 'react'
import { useHabitsStore } from '@/store/habits'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { HabitIcon } from './habit-icon'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Plus } from 'lucide-react'

const ICON_OPTIONS = [
  'Dumbbell', 'Book', 'Code', 'Brain', 'Droplets', 'Moon', 'Sun', 'Heart',
  'Salad', 'Pill', 'Pencil', 'Music', 'Bike', 'Footprints', 'Eye', 'Coffee',
  'Cigarette', 'Wine', 'Smartphone', 'Timer', 'MessageSquare', 'Wallet', 'Leaf', 'Zap',
]

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const TARGET_PRESETS = [21, 30, 60, 90]

interface HabitCreatorProps {
  defaultExpanded?: boolean
}

export function HabitCreator({ defaultExpanded = false }: HabitCreatorProps) {
  const addHabit = useHabitsStore((s) => s.addHabit)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Dumbbell')
  const [frequency, setFrequency] = useState<'daily' | 'weekdays' | 'weekends' | 'custom'>('daily')
  const [customDays, setCustomDays] = useState<number[]>([])
  const [targetDays, setTargetDays] = useState<number | null>(null)
  const [customTarget, setCustomTarget] = useState('')

  const reset = () => {
    setName('')
    setIcon('Dumbbell')
    setFrequency('daily')
    setCustomDays([])
    setTargetDays(null)
    setCustomTarget('')
  }

  const handleCreate = () => {
    if (!name.trim()) return
    addHabit({
      name: name.trim(),
      icon,
      frequency,
      customDays: frequency === 'custom' ? customDays : undefined,
      targetDays,
    })
    reset()
  }

  const toggleDay = (day: number) => {
    setFrequency('custom')
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const applyPreset = (preset: 'daily' | 'weekdays' | 'weekends') => {
    setFrequency(preset)
    if (preset === 'daily') setCustomDays([0, 1, 2, 3, 4, 5, 6])
    else if (preset === 'weekdays') setCustomDays([1, 2, 3, 4, 5])
    else setCustomDays([0, 6])
  }

  const selectedDays = frequency === 'daily'
    ? [0, 1, 2, 3, 4, 5, 6]
    : frequency === 'weekdays'
      ? [1, 2, 3, 4, 5]
      : frequency === 'weekends'
        ? [0, 6]
        : customDays

  return (
    <Card className="p-4">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-base font-medium text-zinc-300"
      >
        <span className="flex items-center gap-3">
          <Plus size={18} className="text-indigo-400" />
          New Habit
        </span>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Name */}
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Habit name..."
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />

          {/* Icon picker */}
          <div>
            <p className="text-sm text-zinc-500 mb-2">Icon</p>
            <div className="grid grid-cols-8 gap-2">
              {ICON_OPTIONS.map((iconName) => (
                <button
                  key={iconName}
                  onClick={() => setIcon(iconName)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
                    icon === iconName
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
                      : 'border-white/[0.08] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                  )}
                  title={iconName}
                >
                  <HabitIcon name={iconName} size={20} />
                </button>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div>
            <p className="text-sm text-zinc-500 mb-2">Schedule</p>
            <div className="flex gap-2 mb-2">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-md border text-sm font-medium transition-colors',
                    selectedDays.includes(i)
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
                      : 'border-white/[0.08] text-zinc-500 hover:border-zinc-600'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {(['daily', 'weekdays', 'weekends'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    'rounded-md border px-2.5 py-2 text-sm transition-colors',
                    frequency === preset
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
                      : 'border-white/[0.08] text-zinc-500 hover:border-zinc-600'
                  )}
                >
                  {preset.charAt(0).toUpperCase() + preset.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Target */}
          <div>
            <p className="text-sm text-zinc-500 mb-2">Target (optional)</p>
            <div className="flex gap-2 flex-wrap">
              {TARGET_PRESETS.map((days) => (
                <button
                  key={days}
                  onClick={() => {
                    setTargetDays(targetDays === days ? null : days)
                    setCustomTarget('')
                  }}
                  className={cn(
                    'rounded-md border px-2.5 py-2 text-sm transition-colors',
                    targetDays === days
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
                      : 'border-white/[0.08] text-zinc-500 hover:border-zinc-600'
                  )}
                >
                  {days}d
                </button>
              ))}
              <Input
                type="number"
                placeholder="Custom"
                value={customTarget}
                onChange={(e) => {
                  setCustomTarget(e.target.value)
                  const val = parseInt(e.target.value)
                  setTargetDays(val > 0 ? val : null)
                }}
                className="w-20 h-7 text-sm"
              />
            </div>
          </div>

          {/* Create */}
          <Button onClick={handleCreate} disabled={!name.trim()} className="w-full">
            <Plus size={18} />
            Create Habit
          </Button>
        </div>
      )}
    </Card>
  )
}
