import { startOfWeek, startOfMonth, format, subWeeks, subMonths, isAfter, differenceInDays } from 'date-fns'
import type { GitLabMergeRequest } from '@/types/gitlab'

export interface MRMetrics {
  created: number
  merged: number
  open: number
  closed: number
  locked: number
  drafts: number
  withConflicts: number
  avgMergeTimeHours: number | null
  mergeRate: number
  commentsReceived: number
  reviewsDone: number
}

export interface TimeDataPoint {
  label: string
  created: number
  merged: number
}

export function computeMetrics(
  authored: GitLabMergeRequest[],
  reviewed: GitLabMergeRequest[]
): MRMetrics {
  const merged = authored.filter((mr) => mr.state === 'merged')
  const open = authored.filter((mr) => mr.state === 'opened')
  const closed = authored.filter((mr) => mr.state === 'closed')
  const locked = authored.filter((mr) => mr.state === 'locked')
  const drafts = authored.filter((mr) => mr.draft)
  const withConflicts = authored.filter((mr) => mr.has_conflicts)

  const mergeTimes = merged
    .filter((mr) => mr.merged_at)
    .map((mr) => new Date(mr.merged_at!).getTime() - new Date(mr.created_at).getTime())

  const avgMergeTimeHours =
    mergeTimes.length > 0
      ? mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length / (1000 * 60 * 60)
      : null

  const commentsReceived = authored.reduce((sum, mr) => sum + mr.user_notes_count, 0)
  const mergeRate = authored.length > 0 ? (merged.length / authored.length) * 100 : 0

  return {
    created: authored.length,
    merged: merged.length,
    open: open.length,
    closed: closed.length,
    locked: locked.length,
    drafts: drafts.length,
    withConflicts: withConflicts.length,
    avgMergeTimeHours,
    mergeRate,
    commentsReceived,
    reviewsDone: reviewed.length,
  }
}

export function computeTimeData(
  authored: GitLabMergeRequest[],
  days: number
): TimeDataPoint[] {
  // Use monthly buckets for periods > 180 days, weekly otherwise
  if (days === 0 || days > 180) {
    return computeMonthlyData(authored, days)
  }
  return computeWeeklyData(authored, Math.ceil(days / 7))
}

function computeWeeklyData(
  authored: GitLabMergeRequest[],
  weeks: number
): TimeDataPoint[] {
  const now = new Date()
  const result: TimeDataPoint[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
    const weekEnd = startOfWeek(subWeeks(now, i - 1), { weekStartsOn: 1 })

    const created = authored.filter((mr) => {
      const d = new Date(mr.created_at)
      return isAfter(d, weekStart) && !isAfter(d, weekEnd)
    }).length

    const merged = authored.filter((mr) => {
      if (!mr.merged_at) return false
      const d = new Date(mr.merged_at)
      return isAfter(d, weekStart) && !isAfter(d, weekEnd)
    }).length

    result.push({ label: format(weekStart, 'MMM d'), created, merged })
  }

  return result
}

function computeMonthlyData(
  authored: GitLabMergeRequest[],
  days: number
): TimeDataPoint[] {
  const now = new Date()
  // For "all time" (days=0), determine range from data
  let months: number
  if (days === 0 && authored.length > 0) {
    const oldest = authored.reduce((min, mr) =>
      new Date(mr.created_at) < new Date(min.created_at) ? mr : min
    )
    months = Math.ceil(differenceInDays(now, new Date(oldest.created_at)) / 30) + 1
    months = Math.min(months, 60) // cap at 5 years
  } else {
    months = Math.ceil(days / 30)
  }

  const result: TimeDataPoint[] = []

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i))
    const monthEnd = startOfMonth(subMonths(now, i - 1))

    const created = authored.filter((mr) => {
      const d = new Date(mr.created_at)
      return isAfter(d, monthStart) && !isAfter(d, monthEnd)
    }).length

    const merged = authored.filter((mr) => {
      if (!mr.merged_at) return false
      const d = new Date(mr.merged_at)
      return isAfter(d, monthStart) && !isAfter(d, monthEnd)
    }).length

    result.push({ label: format(monthStart, 'MMM yy'), created, merged })
  }

  return result
}
