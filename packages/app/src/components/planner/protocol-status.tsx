import type { LifeOsStats } from '@zync/shared/types'
import { CheckCircle2, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'

export function ProtocolStatus({ stats }: { stats?: LifeOsStats | null }) {
  const navigate = useNavigate()
  const morningDone = stats?.morningDone ?? false
  const eveningDone = stats?.eveningDone ?? false

  return (
    <Card className="gap-0 border-border bg-secondary py-0">
      <CardContent className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Daily Protocols</h3>
        <div className="space-y-3">
          <button
            onClick={() => !morningDone && navigate('/s/morning')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent"
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${morningDone ? 'bg-emerald-600/20 dark:bg-emerald-400/20' : 'bg-primary/10'}`}
            >
              <Sun size={16} className={morningDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">Morning Protocol</p>
              <p className="text-xs text-muted-foreground">Psychological excavation</p>
            </div>
            {morningDone ? (
              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Start</span>
            )}
          </button>

          <button
            onClick={() => !eveningDone && navigate('/s/evening')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent"
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${eveningDone ? 'bg-emerald-600/20 dark:bg-emerald-400/20' : 'bg-muted'}`}
            >
              <Moon
                size={16}
                className={eveningDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}
              />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">Evening Synthesis</p>
              <p className="text-xs text-muted-foreground">Reflect & plan tomorrow</p>
            </div>
            {eveningDone ? (
              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Start</span>
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
