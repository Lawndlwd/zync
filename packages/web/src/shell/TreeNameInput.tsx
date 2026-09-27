import { useRef, useState } from 'react'

import type { TreeEntry } from '../types/files'
import type { TreeCtx } from '../types/shell'
import { depthProps } from './helpers'

export function TreeNameInput({ depth, ctx, entry }: { depth: number; ctx: TreeCtx; entry?: TreeEntry }) {
  const { cls, style } = depthProps(depth)
  const [v, setV] = useState(entry?.name ?? '')
  const done = useRef(false)
  const label = entry ? 'Rename' : ctx.creating?.kind === 'folder' ? 'New folder name' : 'New page name'
  const commit = () => {
    if (done.current) return
    done.current = true
    if (entry) ctx.rename(entry, v)
    else ctx.create(v)
  }
  const cancel = () => {
    if (done.current) return
    done.current = true
    if (entry) ctx.cancelRename()
    else ctx.cancelCreate()
  }
  return (
    <div className={`ti${cls} creating`} style={style}>
      <input
        aria-label={label}
        autoFocus
        value={v}
        placeholder={ctx.creating?.kind === 'folder' ? 'folder' : 'Untitled.md'}
        onFocus={(e) => {
          const dot = e.target.value.lastIndexOf('.')
          e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length)
        }}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') cancel()
        }}
        onBlur={() => (v.trim() && !entry ? commit() : cancel())}
      />
    </div>
  )
}
