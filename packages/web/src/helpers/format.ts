// Text shown in the UI.

/** A readable message for anything thrown. */
export const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/** A run's length: "42s", "3m 05s"; "—" when unknown. */
export function formatDuration(ms?: number): string {
  if (!ms) return '—'
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

/** The first non-blank line, trimmed. */
export const firstLine = (s?: string) =>
  s
    ?.split('\n')
    .find((l) => l.trim())
    ?.trim()

/** "1 task", "3 tasks" */
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** "Ada Lovelace" → "AL"; "?" when there is nothing to take. */
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  )
}
