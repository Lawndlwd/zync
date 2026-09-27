import { useEffect, useRef } from 'react'

import { keepInViewport } from '../helpers/dom'
import { useAnchoredPosition } from '../hooks/useAnchoredPosition'
import { useElement } from '../hooks/useElement'
import { useEventListener } from '../hooks/useEventListener'
import { useHotkeys } from '../hooks/useHotkeys'
import type { Tip } from '../types/onboarding'
import { Button } from './Button'

const PAD = 6
const GAP = 14

/**
 * Dims the app except one control and explains it in a card beside it. Nothing is blocked: the
 * highlighted control works as usual, and any click, Esc or "Got it" closes the tip.
 */
export function Spotlight({ tip, onClose }: { tip: Tip; onClose: () => void }) {
  const target = useElement(tip.target)
  const holeRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const hole = useAnchoredPosition(
    holeRef,
    () => {
      if (!target) return null
      const r = target.getBoundingClientRect()
      return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
    },
    { enabled: target !== null, at: target },
  )
  const card = useAnchoredPosition(
    cardRef,
    () => {
      const box = cardRef.current
      if (!box) return null
      // The control isn't on screen (yet): explain it in the middle.
      if (!target)
        return { top: '40%', left: keepInViewport((window.innerWidth - box.offsetWidth) / 2, box.offsetWidth) }
      const r = target.getBoundingClientRect()
      const below = r.bottom + PAD + GAP + box.offsetHeight < window.innerHeight
      return {
        top: below ? r.bottom + PAD + GAP : Math.max(8, r.top - PAD - GAP - box.offsetHeight),
        left: keepInViewport(r.left + r.width / 2 - box.offsetWidth / 2, box.offsetWidth),
      }
    },
    { at: target },
  )

  // Bring the control into view once it's there.
  useEffect(() => {
    target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [target])

  useEventListener(
    'pointerdown',
    (e) => {
      if (e.target instanceof Node && cardRef.current?.contains(e.target)) return
      onClose()
    },
    { target: document, capture: true },
  )
  useHotkeys((e) => {
    if (e.key === 'Escape') onClose()
  })

  return (
    <>
      {target ? <div ref={holeRef} className="spot-hole" style={hole} /> : <div className="spot-shade" />}
      <div ref={cardRef} className="spot-card floating" role="dialog" aria-label={tip.title} style={card}>
        <span className="mono-s muted">Getting started</span>
        <span className="h3">{tip.title}</span>
        <p className="small">{tip.body}</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="primary" size="sm" autoFocus onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </>
  )
}
