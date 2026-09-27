import type { EditorView } from '@milkdown/kit/prose/view'
import { useRef } from 'react'
import { createPortal } from 'react-dom'

import { keepInViewport } from '../../helpers/dom'
import { useAnchoredPosition } from '../../hooks/useAnchoredPosition'
import { useScrollActiveIntoView } from '../../hooks/useScrollActiveIntoView'
import type { PickItem } from './types'

export function PickMenu({
  view,
  at,
  items,
  sel,
  setSel,
  onPick,
}: {
  view: EditorView
  at: number
  items: PickItem[]
  sel: number
  setSel: (i: number) => void
  onPick: (item: PickItem) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const pos = useAnchoredPosition(
    ref,
    () => {
      const c = view.coordsAtPos(at)
      const h = ref.current?.offsetHeight ?? 280
      const w = ref.current?.offsetWidth ?? 320
      const top = window.innerHeight - c.bottom < h + 12 && c.top > h + 12 ? c.top - h - 6 : c.bottom + 6
      return { top, left: keepInViewport(c.left, w) }
    },
    { at },
  )
  useScrollActiveIntoView(ref, sel)

  let idx = -1
  const groups = [...new Set(items.map((i) => i.group))]
  return createPortal(
    <div
      ref={ref}
      className="menu floating pick-menu"
      role="listbox"
      tabIndex={-1}
      style={pos}
      // Keep focus (and the caret) in the editor.
      onMouseDown={(e) => e.preventDefault()}
    >
      {groups.map((g) => (
        <div key={g} className="col" style={{ gap: 2 }}>
          <span className="mh">{g}</span>
          {items
            .filter((i) => i.group === g)
            .map((it) => {
              idx++
              const i = idx
              return (
                <button
                  key={it.key}
                  type="button"
                  role="option"
                  aria-selected={i === sel}
                  className={`mi${i === sel ? ' on' : ''}`}
                  onMouseMove={() => setSel(i)}
                  onClick={() => onPick(it)}
                >
                  {it.icon}
                  <span className="grow trunc" style={{ textAlign: 'left' }}>
                    {it.text}
                  </span>
                  {it.meta && <span className="mono-s muted trunc pick-meta">{it.meta}</span>}
                </button>
              )
            })}
        </div>
      ))}
      <div className="row g12 mono-s muted pick-foot">
        <span>↑↓ move</span>
        <span>↵ insert</span>
        <span>esc close</span>
      </div>
    </div>,
    document.body,
  )
}
