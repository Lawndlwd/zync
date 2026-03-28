import { XIcon } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm animate-in fade-in-0"
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <div className={cn('fixed inset-y-0 left-0 z-50 w-72 bg-card shadow-ambient-lg animate-in slide-in-from-left')}>
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <XIcon size={18} />
        </button>
        {children}
      </div>
    </>
  )
}
