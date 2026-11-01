import type { ReactNode } from 'react'

import { STAGE_LABEL, STAGE_RULE } from '../helpers/becoming'
import type { Stage } from '../types/becoming'

/** One stage of the Becoming board: its name, count, rule, and the identities in it. */
export function StageColumn({
  stage,
  count,
  note,
  children,
  footer,
}: {
  stage: Stage
  count: number
  note?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="kcol" style={{ width: 'auto' }} aria-label={STAGE_LABEL[stage]}>
      <div className="kcol-h">
        <span className="n">
          <b>{count}</b>
          {STAGE_LABEL[stage]}
        </span>
        <span className="mono-s muted">{STAGE_RULE[stage]}</span>
      </div>
      {note}
      {children}
      {footer}
    </section>
  )
}
