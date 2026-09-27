import { useEffect, useState } from 'react'

/**
 * The version of a file an editor was loaded with. Replaced when the file changes on disk (the AI,
 * a calendar drag, another tab) — but never while there are local edits (`dirty`), and never
 * because of our own save echoing back (`ownMtime`). `external` flags such a reload for 4 seconds.
 */
export function useFileSnapshot<T extends { mtime: number }>(
  data: T | undefined,
  { ownMtime, dirty }: { ownMtime: number | null; dirty: boolean },
): { loaded: T | null; external: boolean; setLoaded: (d: T) => void } {
  const [loaded, setLoaded] = useState<T | null>(data ?? null)
  const [seen, setSeen] = useState(data)
  const [externalAt, setExternalAt] = useState<number | null>(null)

  if (data !== seen) {
    setSeen(data)
    if (data && !loaded) setLoaded(data)
    else if (data && loaded && data.mtime !== loaded.mtime && data.mtime !== ownMtime && !dirty) {
      setLoaded(data)
      setExternalAt(data.mtime)
    }
  }

  useEffect(() => {
    if (externalAt === null) return
    const t = window.setTimeout(() => setExternalAt(null), 4000)
    return () => window.clearTimeout(t)
  }, [externalAt])

  return { loaded, external: externalAt !== null, setLoaded }
}
