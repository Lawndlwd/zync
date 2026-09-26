import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import { useEffect, useRef } from 'react'

/** Notion-style WYSIWYG markdown editor. Uncontrolled: remount (via key) to load new content. */
export function MarkdownEditor({ value, onChange }: { value: string; onChange: (md: string) => void }) {
  const root = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!root.current) return
    const crepe = new Crepe({ root: root.current, defaultValue: value })
    let ready = false
    crepe.on((l) =>
      l.markdownUpdated((_ctx, md, prev) => {
        if (ready && md !== prev) onChangeRef.current(md)
      }),
    )
    const created = crepe.create().then(() => {
      ready = true
    })
    return () => {
      void created.then(() => crepe.destroy())
    }
  }, [])

  return <div ref={root} className="md-editor" />
}
