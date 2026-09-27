import { textOn } from '../helpers/color'
import { initials } from '../helpers/format'
import { IconSpark } from '../icons'
import type { Person } from '../types/people'

export function PersonAvatar({
  id,
  people,
  size,
  className = '',
}: {
  id?: string
  people: Person[]
  size?: 'l' | 'xl'
  className?: string
}) {
  if (!id) return null
  const p = people.find((x) => x.id === id)
  const name = p?.name ?? id
  const sz = size ? ` av-${size}` : ''
  if (id === 'ai')
    return (
      <span className={`av av-ai${sz} ${className}`} title="@ai">
        <IconSpark size={size ? 13 : 11} />
      </span>
    )
  if (id === 'me')
    return (
      <span className={`av av-me${sz} ${className}`} title={`@me · ${name}`}>
        {initials(name)}
      </span>
    )
  const style = p?.color
    ? { background: p.color, color: textOn(p.color) }
    : { background: 'var(--sage-1)', color: 'var(--ink)' }
  return (
    <span className={`av${sz} ${className}`} style={style} title={`@${id} · ${name}`}>
      {initials(name)}
    </span>
  )
}
