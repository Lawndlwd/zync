import { useEventListener } from './useEventListener'

/** Window-level keyboard shortcuts. Subscribes once; `handler` always sees the latest render. */
export function useHotkeys(handler: (e: KeyboardEvent) => void, { enabled = true }: { enabled?: boolean } = {}) {
  useEventListener('keydown', handler, { enabled })
}
