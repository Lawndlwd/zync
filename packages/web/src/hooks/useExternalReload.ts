import { type FocusEvent, useEffect, useEffectEvent, useRef, useState } from 'react'

/**
 * For an uncontrolled editor showing `value` from the server: `version` bumps (remount the editor
 * with it in its key) only when the text really changed underneath — not from our own save
 * echoing back (call `edited` on every local change), not while `busy` (edits pending or saving),
 * and not while the editor inside `box` has focus (applied when it loses focus instead).
 */
export function useExternalReload(value: string, busy: () => boolean) {
  const [version, setVersion] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const last = useRef(value.trim())
  const stale = useRef(false)

  const check = (v: string) => {
    if (busy()) return
    if (v.trim() === last.current) {
      stale.current = false
      return
    }
    if (box.current?.contains(document.activeElement)) {
      stale.current = true
      return
    }
    stale.current = false
    last.current = v.trim()
    setVersion((k) => k + 1)
  }
  const onValue = useEffectEvent(check)
  useEffect(() => onValue(value), [value])

  return {
    version,
    box,
    edited: (text: string) => {
      last.current = text.trim()
    },
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (stale.current && !e.currentTarget.contains(e.relatedTarget)) check(value)
    },
  }
}
