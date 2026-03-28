import { Link } from 'react-router-dom'

export function MiniCard({
  icon: Icon,
  iconColor,
  label,
  to,
  children,
}: {
  icon: React.ElementType
  iconColor: string
  label: string
  to: string
  children: React.ReactNode
}) {
  return (
    <Link to={to} className="col-span-6 lg:col-span-2 px-6 py-5 hover:shadow-ambient-lg transition-shadow">
      <div className="flex items-center gap-2.5 mb-3">
        <Icon size={18} className={iconColor} />
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      </div>
      <div>{children}</div>
    </Link>
  )
}
