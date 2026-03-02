import { useState, useMemo, useCallback, useEffect } from 'react'
import cronstrue from 'cronstrue'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

interface SchedulePickerProps {
  value: string
  onChange: (cron: string) => void
  label?: string
  className?: string
}

const DAYS = [
  { key: '1', short: 'M', label: 'Monday' },
  { key: '2', short: 'T', label: 'Tuesday' },
  { key: '3', short: 'W', label: 'Wednesday' },
  { key: '4', short: 'T', label: 'Thursday' },
  { key: '5', short: 'F', label: 'Friday' },
  { key: '6', short: 'S', label: 'Saturday' },
  { key: '0', short: 'S', label: 'Sunday' },
] as const

const WEEKDAY_KEYS = new Set(['1', '2', '3', '4', '5'])
const WEEKEND_KEYS = new Set(['6', '0'])
const ALL_KEYS = new Set(['0', '1', '2', '3', '4', '5', '6'])

// Generate time options in 30-min intervals (12h format)
function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      const period = h < 12 ? 'AM' : 'PM'
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      options.push({
        value: `${hh}:${mm}`,
        label: `${h12}:${mm} ${period}`,
      })
    }
  }
  return options
}

const TIME_OPTIONS = generateTimeOptions()

type DayPreset = 'every' | 'weekdays' | 'weekends' | 'custom'

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

function daySetToPreset(days: Set<string>): DayPreset {
  if (setsEqual(days, ALL_KEYS)) return 'every'
  if (setsEqual(days, WEEKDAY_KEYS)) return 'weekdays'
  if (setsEqual(days, WEEKEND_KEYS)) return 'weekends'
  return 'custom'
}

function presetToDaySet(preset: DayPreset): Set<string> {
  if (preset === 'every') return new Set(ALL_KEYS)
  if (preset === 'weekdays') return new Set(WEEKDAY_KEYS)
  if (preset === 'weekends') return new Set(WEEKEND_KEYS)
  return new Set()
}

/**
 * Try to parse a cron string of form `M H * * D` into simple mode values.
 * Returns null if the cron is too complex for simple mode.
 */
function parseSimpleCron(
  cron: string
): { time: string; days: Set<string> } | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return null

  const [minute, hour, dom, month, dow] = parts

  // Must be `* *` for day-of-month and month
  if (dom !== '*' || month !== '*') return null

  // Minute and hour must be plain numbers
  if (!/^\d{1,2}$/.test(minute) || !/^\d{1,2}$/.test(hour)) return null

  const m = parseInt(minute, 10)
  const h = parseInt(hour, 10)
  if (m < 0 || m > 59 || h < 0 || h > 23) return null
  // Only allow 30-min interval times
  if (m !== 0 && m !== 30) return null

  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

  // Parse day-of-week
  if (dow === '*') {
    return { time, days: new Set(ALL_KEYS) }
  }

  const days = new Set<string>()
  // Split by comma, handle ranges like 1-5
  const segments = dow.split(',')
  for (const seg of segments) {
    const rangeMatch = seg.match(/^(\d)-(\d)$/)
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10)
      const end = parseInt(rangeMatch[2], 10)
      for (let i = start; i <= end; i++) {
        days.add(String(i))
      }
    } else if (/^\d$/.test(seg)) {
      days.add(seg)
    } else {
      return null // unparseable
    }
  }

  return { time, days }
}

function buildCron(time: string, days: Set<string>): string {
  const [hh, mm] = time.split(':')
  const h = parseInt(hh, 10)
  const m = parseInt(mm, 10)

  let dow: string
  if (days.size === 0 || setsEqual(days, ALL_KEYS)) {
    dow = '*'
  } else {
    // Sort numerically and try to collapse into ranges
    const sorted = [...days].map(Number).sort((a, b) => a - b)
    dow = sorted.join(',')
  }

  return `${m} ${h} * * ${dow}`
}

function humanReadable(cron: string): string | null {
  try {
    return cronstrue.toString(cron, { use24HourTimeFormat: false })
  } catch {
    return null
  }
}

export function SchedulePicker({
  value,
  onChange,
  label,
  className,
}: SchedulePickerProps) {
  // Determine initial mode from value
  const parsed = useMemo(() => parseSimpleCron(value), [value])
  const [advanced, setAdvanced] = useState(!parsed)
  const [rawCron, setRawCron] = useState(value)
  const [time, setTime] = useState(parsed?.time ?? '09:00')
  const [dayPreset, setDayPreset] = useState<DayPreset>(
    parsed ? daySetToPreset(parsed.days) : 'every'
  )
  const [customDays, setCustomDays] = useState<Set<string>>(
    parsed ? parsed.days : new Set(ALL_KEYS)
  )

  // Sync raw cron when value prop changes externally
  useEffect(() => {
    const p = parseSimpleCron(value)
    if (p) {
      setTime(p.time)
      const preset = daySetToPreset(p.days)
      setDayPreset(preset)
      setCustomDays(p.days)
      setAdvanced(false)
    } else {
      setAdvanced(true)
    }
    setRawCron(value)
  }, [value])

  const handleTimeChange = useCallback(
    (newTime: string) => {
      setTime(newTime)
      const days = dayPreset === 'custom' ? customDays : presetToDaySet(dayPreset)
      const cron = buildCron(newTime, days)
      setRawCron(cron)
      onChange(cron)
    },
    [dayPreset, customDays, onChange]
  )

  const handlePresetChange = useCallback(
    (preset: DayPreset) => {
      setDayPreset(preset)
      if (preset !== 'custom') {
        const days = presetToDaySet(preset)
        setCustomDays(days)
        const cron = buildCron(time, days)
        setRawCron(cron)
        onChange(cron)
      }
    },
    [time, onChange]
  )

  const toggleDay = useCallback(
    (dayKey: string) => {
      const next = new Set(customDays)
      if (next.has(dayKey)) {
        next.delete(dayKey)
      } else {
        next.add(dayKey)
      }
      setCustomDays(next)
      setDayPreset('custom')
      const cron = buildCron(time, next)
      setRawCron(cron)
      onChange(cron)
    },
    [customDays, time, onChange]
  )

  const handleRawChange = useCallback(
    (raw: string) => {
      setRawCron(raw)
      // Only fire onChange if it looks like a valid 5-part cron
      if (raw.trim().split(/\s+/).length === 5) {
        onChange(raw.trim())
      }
    },
    [onChange]
  )

  const switchToAdvanced = useCallback(() => {
    setAdvanced(true)
  }, [])

  const switchToSimple = useCallback(() => {
    const p = parseSimpleCron(rawCron)
    if (p) {
      setTime(p.time)
      setDayPreset(daySetToPreset(p.days))
      setCustomDays(p.days)
      setAdvanced(false)
    }
  }, [rawCron])

  const canSwitchToSimple = useMemo(
    () => parseSimpleCron(rawCron) !== null,
    [rawCron]
  )

  const preview = useMemo(() => humanReadable(rawCron), [rawCron])

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-xs font-medium text-zinc-400">{label}</label>
      )}

      {!advanced ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Select value={time} onValueChange={handleTimeChange}>
              <SelectTrigger size="sm" className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dayPreset} onValueChange={(v) => handlePresetChange(v as DayPreset)}>
              <SelectTrigger size="sm" className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="every">Every day</SelectItem>
                <SelectItem value="weekdays">Weekdays (Mon-Fri)</SelectItem>
                <SelectItem value="weekends">Weekends (Sat-Sun)</SelectItem>
                <SelectItem value="custom">Custom...</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dayPreset === 'custom' && (
            <div className="flex gap-1">
              {DAYS.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => toggleDay(day.key)}
                  title={day.label}
                  className={cn(
                    'h-7 w-7 rounded text-xs font-medium transition-colors',
                    customDays.has(day.key)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white/[0.06] text-zinc-400 hover:bg-white/[0.1]'
                  )}
                >
                  {day.short}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Input
            value={rawCron}
            onChange={(e) => handleRawChange(e.target.value)}
            placeholder="0 9 * * 1-5"
            className="font-mono"
          />
        </div>
      )}

      {/* Footer: preview + mode toggle */}
      <div className="flex items-center justify-between">
        {preview ? (
          <p className="text-xs text-zinc-500">{preview}</p>
        ) : (
          <p className="text-xs text-red-400">Invalid cron expression</p>
        )}
        <button
          type="button"
          onClick={advanced ? switchToSimple : switchToAdvanced}
          disabled={advanced && !canSwitchToSimple}
          className="text-xs text-indigo-400 hover:text-indigo-300 disabled:text-zinc-600 disabled:cursor-not-allowed"
        >
          {advanced ? 'Simple mode' : 'Advanced'}
        </button>
      </div>
    </div>
  )
}
