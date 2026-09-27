import { Suspense } from 'react'

import { LazyMarkdownEditor } from '../components/LazyMarkdownEditor'
import { useDebouncedSave } from '../hooks/useDebouncedSave'
import { useExternalReload } from '../hooks/useExternalReload'

/**
 * The markdown editor bound to a file on the server: edits save after a pause (and when leaving),
 * and the editor reloads only when the file really changed underneath (the AI saved to it) — never
 * from our own save echoing back, while a save is in flight, or while you're typing. Same rules as
 * a card's body (CardDocument).
 */
export function LiveMarkdown({
  docKey,
  value,
  onSave,
  ws,
}: {
  /** Identity of the document: switching it saves the pending edit (to its own document) and resets the editor. */
  docKey: string
  /** The server's current text. */
  value: string
  onSave: (md: string) => Promise<unknown>
  ws?: string
}) {
  const saver = useDebouncedSave<string>()
  const { version, box, edited, onBlur } = useExternalReload(value, saver.busy)

  return (
    <div ref={box} onBlur={onBlur}>
      <Suspense fallback={<div className="skel" style={{ height: 160 }} />}>
        <LazyMarkdownEditor
          key={`${docKey}:${version}`}
          ws={ws}
          value={value}
          onChange={(md) => {
            edited(md)
            saver.schedule(docKey, md, onSave)
          }}
        />
      </Suspense>
    </div>
  )
}
