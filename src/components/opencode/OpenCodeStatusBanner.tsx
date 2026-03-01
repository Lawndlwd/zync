import { Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOpenCodeStatus } from '@/hooks/useOpenCode'
import { useOpenCodeStore } from '@/store/opencode'

export function OpenCodeStatusBanner() {
  const { data: status, isLoading, refetch } = useOpenCodeStatus()
  const serverUrl = useOpenCodeStore((s) => s.serverUrl)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-6 py-2 text-xs text-zinc-500 border-b border-white/[0.04]">
        <Loader2 size={12} className="animate-spin text-zinc-600" />
        <span>Connecting...</span>
      </div>
    )
  }

  if (!status?.connected) {
    return (
      <div className="flex items-center gap-3 px-6 py-2.5 text-sm border-b border-amber-500/20 bg-amber-500/[0.04]">
        <AlertTriangle size={14} className="text-amber-400 shrink-0" />
        <span className="text-amber-200/80 text-xs">
          Cannot reach OpenCode at{' '}
          <code className="font-mono text-amber-300/90">{serverUrl}</code>
        </span>
        <code className="ml-auto text-[11px] font-mono text-amber-400/50">
          opencode serve --cors http://localhost:5173
        </code>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/10"
          onClick={() => refetch()}
        >
          <RefreshCw size={12} className="mr-1" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-6 py-1.5 text-[11px] text-zinc-600 border-b border-white/[0.04]">
      <CheckCircle2 size={10} className="text-emerald-600" />
      <span>
        Connected to{' '}
        <span className="font-mono text-zinc-500">{serverUrl}</span>
      </span>
    </div>
  )
}
