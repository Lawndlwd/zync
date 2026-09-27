import { useSyncExternalStore } from 'react'

const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange)
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}

/**
 * The first element matching `selector`, kept live: null until it is in the document (views load
 * lazily, so it may appear a moment after navigating) and again once it leaves.
 */
export function useElement(selector: string): HTMLElement | null {
  return useSyncExternalStore(subscribe, () => {
    const el = document.querySelector(selector)
    return el instanceof HTMLElement ? el : null
  })
}
