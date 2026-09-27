/** A YAML scalar or collection value as one line of text. */
export function textOf(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  return JSON.stringify(value)
}

export const DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/

export const LIST_KEYS = new Set(['labels', 'context', 'tags', 'people'])

export const DATE_KEYS = new Set(['due', 'runAt', 'run_at', 'date', 'start', 'end'])
/** Date keys that point forward: a card's due date and AI run time can't be picked in the past. */
export const FUTURE_KEYS = new Set(['due', 'runAt', 'run_at'])
