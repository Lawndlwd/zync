import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface IntegrationCardProps {
  id: string
  name: string
  icon: React.ReactNode
  status: 'connected' | 'configured' | 'off'
  children: React.ReactNode
}

const statusConfig = {
  connected: { label: 'Connected', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  configured: { label: 'Configured', dot: 'bg-amber-400', text: 'text-amber-400' },
  off: { label: 'Not configured', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
}

export function IntegrationCard({ id, name, icon, status, children }: IntegrationCardProps) {
  const [open, setOpen] = useState(false)
  const s = statusConfig[status]

  return (
    <div id={`integration-${id}`} className="rounded-xl bg-card border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-accent transition-colors"
      >
        {icon}
        <span className="flex-1 text-sm font-medium text-foreground">{name}</span>
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full', s.dot)} />
          <span className={cn('text-xs', s.text)}>{s.label}</span>
        </div>
        <ChevronDown
          size={16}
          className={cn('text-muted-foreground transition-transform', open ? 'rotate-0' : '-rotate-90')}
        />
      </button>

      {open && <div className="border-t border-border px-5 py-4">{children}</div>}
    </div>
  )
}
