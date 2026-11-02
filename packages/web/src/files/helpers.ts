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

/** Keys that name an item of a list of objects (e.g. a brief's to-dos), in order of preference. */
const TITLE_KEYS = ['title', 'name', 'label', 'text']

/**
 * One item of a list of objects, for reading: its title (the first title-like field, else the first
 * text) and the other fields as key/value text.
 */
export function itemSummary(item: unknown): { title: string; details: Array<[string, string]> } {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return { title: textOf(item), details: [] }
  const entries = Object.entries(item)
  const titleKey =
    TITLE_KEYS.find((k) => typeof Reflect.get(item, k) === 'string') ??
    entries.find(([, v]) => typeof v === 'string')?.[0]
  return {
    title: titleKey ? textOf(Reflect.get(item, titleKey)) : '',
    details: entries.filter(([k]) => k !== titleKey).map(([k, v]) => [k, textOf(v)]),
  }
}
