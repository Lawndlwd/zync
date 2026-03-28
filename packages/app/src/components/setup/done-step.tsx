import { ArrowRight, CheckCircle2, PartyPopper, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSetupStore } from '@/store/setup'

const displayNames: Record<string, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  gmail: 'Gmail',
}

export function DoneStep() {
  const { selectedIntegrations, verificationResults } = useSetupStore()

  const results = selectedIntegrations.map((id) => ({
    id,
    result: verificationResults[id],
  }))

  return (
    <div className="flex flex-col items-center text-center max-w-lg mx-auto">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20">
        <PartyPopper className="h-8 w-8 text-emerald-400" />
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">You're All Set!</h2>
      <p className="text-muted-foreground mb-8 text-sm">
        Your dashboard is ready to go. You can always adjust these in Settings.
      </p>

      {results.length > 0 && (
        <div className="w-full bg-card rounded-3xl border border-border p-4 mb-6">
          <p className="text-xs font-medium text-muted-foreground mb-3 text-left">Integration Status</p>
          <div className="space-y-2">
            {results.map(({ id, result }) => (
              <div key={id} className="flex items-center justify-between rounded-lg bg-secondary px-4 py-2.5">
                <span className="text-sm text-foreground">{displayNames[id] || id}</span>
                <div className="flex items-center gap-1.5">
                  {result?.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : result ? (
                    <XCircle className="h-4 w-4 text-red-400" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Not verified</span>
                  )}
                  <span
                    className={cn(
                      'text-xs',
                      result?.ok ? 'text-emerald-400' : result ? 'text-red-400' : 'text-muted-foreground',
                    )}
                  >
                    {result?.ok ? 'Connected' : result ? result.message : 'Saved'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-primary">
        <span>Click finish to open your dashboard</span>
        <ArrowRight className="h-4 w-4" />
      </div>
    </div>
  )
}
