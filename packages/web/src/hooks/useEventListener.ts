import { useEffect, useEffectEvent } from 'react'

/**
 * Listens to `type` on `target` (window by default) while mounted. The handler always sees the
 * latest props and state, so callers don't memoize it; `enabled: false` detaches the listener.
 */
export function useEventListener<K extends keyof WindowEventMap>(
  type: K,
  handler: (e: WindowEventMap[K]) => void,
  {
    target,
    capture = false,
    enabled = true,
  }: { target?: Window | Document; capture?: boolean; enabled?: boolean } = {},
) {
  const onEvent = useEffectEvent((e: Event) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the event type is keyed by `type`
    handler(e as WindowEventMap[K])
  })
  useEffect(() => {
    if (!enabled) return
    const t = target ?? window
    const on = (e: Event) => onEvent(e)
    t.addEventListener(type, on, capture)
    return () => t.removeEventListener(type, on, capture)
  }, [type, target, capture, enabled])
}
