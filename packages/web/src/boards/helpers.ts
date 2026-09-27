import { firstColumn } from '../helpers/boards'
import type { Board, Draft } from '../types/boards'

export const emptyDraft = (board: Board): Draft => ({
  title: '',
  status: firstColumn(board),
  labels: [],
  description: '',
  context: [],
})

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 480]

/** "1h 30m" */
const formatMinutes = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`)

/** Preset lengths, plus the current one when it was set elsewhere (the calendar, the AI). */
export function durationOptions(current?: number) {
  const all = current && !DURATIONS.includes(current) ? [...DURATIONS, current].toSorted((a, b) => a - b) : DURATIONS
  return all.map((m) => ({ value: String(m), label: formatMinutes(m), text: formatMinutes(m) }))
}

export const DONE_PREVIEW = 5
