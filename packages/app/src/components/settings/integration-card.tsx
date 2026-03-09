import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
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
  off: { label: 'Not configured', dot: 'bg-zinc-600', text: 'text-zinc-500' },
}

export function IntegrationCard({ id, name, icon, status, children }: IntegrationCardProps) {
  const [open, setOpen] = useState(false)
  const s = statusConfig[status]

  return (
    <div id={`integration-${id}`} className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        {icon}
        <span className="flex-1 text-sm font-medium text-zinc-200">{name}</span>
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full', s.dot)} />
          <span className={cn('text-xs', s.text)}>{s.label}</span>
        </div>
        <ChevronDown
          size={16}
          className={cn(
            'text-zinc-500 transition-transform',
            open ? 'rotate-0' : '-rotate-90'
          )}
        />
      </button>

      {open && (
        <div className="border-t border-white/[0.06] px-5 py-4">
          {children}
        </div>
      )}
    </div>
  )
}
