import { useSyncExternalStore } from 'react'

import { readPref, setPref, subscribePrefs } from '../shell/prefs'

/** A localStorage-backed string preference, shared live by every component using the same key. */
export function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- localStorage stores strings; T extends string
  const v = useSyncExternalStore(subscribePrefs, () => readPref(key, fallback)) as T
  return [v, (next: T) => setPref(key, next)]
}
