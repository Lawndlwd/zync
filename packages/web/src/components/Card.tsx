import type { CSSProperties, ReactNode } from 'react'

export function Card({
  title,
  meta,
  className = '',
  style,
  children,
}: {
  title: ReactNode
  meta?: ReactNode
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <section className={`card ${className}`} style={style}>
      <div className="card-h">
        <span className="t">{title}</span>
        {typeof meta === 'string' ? <span className="m">{meta}</span> : meta}
      </div>
      {children}
    </section>
  )
}
