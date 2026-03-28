import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function Section({
  icon: Icon,
  iconColor,
  title,
  to,
  className,
  children,
}: {
  icon: React.ElementType
  iconColor: string
  title: string
  to: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-3xl bg-card border border-border overflow-hidden', className)}>
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <Icon size={22} className={iconColor} />
          <h2 className="text-base font-display font-semibold text-foreground">{title}</h2>
        </div>
        {to && (
          <Link
            to={to}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View all <ArrowRight size={16} />
          </Link>
        )}
      </div>
      <div className="px-6 pb-6">{children}</div>
    </div>
  )
}
