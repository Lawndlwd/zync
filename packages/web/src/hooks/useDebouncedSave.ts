import { useEffect, useState } from 'react'

type Pending<T> = { key: string; value: T; save: (value: T) => Promise<unknown> }

export type Saver<T> = {
  /**
   * Saves `value` with `save` after a pause. `key` names the document: a pending edit for another
   * document is saved right away (to that document) instead of being dropped.
   */
  schedule: (key: string, value: T, save: (value: T) => Promise<unknown>) => void
  /** Saves the pending edit now. Never rejects: on failure the edit stays pending (unless newer). */
  flush: () => Promise<void>
  /** Drops the pending edit. */
  cancel: () => void
  /** An edit is waiting or a save is in flight. */
  busy: () => boolean
}

export function createSaver<T>(ms: number, onBusy: (busy: boolean) => void = () => {}): Saver<T> {
  let pending: Pending<T> | null = null
  let inFlight = 0
  let timer: number | undefined
  const report = () => onBusy(pending !== null || inFlight > 0)

  const flush = async () => {
    window.clearTimeout(timer)
    const p = pending
    if (!p) return
    pending = null
    inFlight++
    report()
    try {
      await p.save(p.value)
    } catch {
      // The save callback reports the error; keep the edit so the next flush retries it.
      pending ??= p
    } finally {
      inFlight--
      report()
    }
  }
  return {
    schedule: (key, value, save) => {
      if (pending && pending.key !== key) void flush()
      pending = { key, value, save }
      report()
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void flush(), ms)
    },
    flush,
    cancel: () => {
      window.clearTimeout(timer)
      pending = null
      report()
    },
    busy: () => pending !== null || inFlight > 0,
  }
}

/**
 * Debounced autosave. Each edit carries the save for its own document, so an edit is never written
 * to the next document after a switch; the pending edit is flushed on unmount. `busy` re-renders
 * when an edit starts or the last save settles.
 */
export function useDebouncedSave<T>(ms = 700): Saver<T> & { pending: boolean } {
  const [busy, setBusy] = useState(false)
  const [saver] = useState(() => createSaver<T>(ms, setBusy))
  useEffect(() => () => void saver.flush(), [saver])
  return { ...saver, pending: busy }
}
