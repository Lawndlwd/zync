import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useOpenCodeStatus, useOpenCodeProviders, useAllSessionsTokens, useAgentModels, useSaveAgentModels } from '@/hooks/useOpenCode'
import { useOpenCodeStore } from '@/store/opencode'
import type { AgentModelConfig } from '@zync/shared/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Circle, RefreshCw, Wifi, WifiOff, Cpu, ChevronDown, Zap, DollarSign, Hash } from 'lucide-react'
import toast from 'react-hot-toast'

const APP_MODEL_KEYS: { key: keyof AgentModelConfig; label: string }[] = [
  { key: 'opencode', label: 'OpenCode Chat' },
  { key: 'prAgent', label: 'PR Agent' },
  { key: 'bot', label: 'Telegram Bot' },
]

function PerAppModelSelectors({ providers }: { providers: { id: string; name: string; models: { id: string; name: string }[] }[] }) {
  const { data: agentModels } = useAgentModels()
  const saveAgentModels = useSaveAgentModels()

  const handleChange = (key: keyof AgentModelConfig, value: string) => {
    const updated: AgentModelConfig = { ...agentModels }
    if (value) {
      updated[key] = { model: value }
    } else {
      delete updated[key]
    }
    saveAgentModels.mutate(updated)
  }

  return (
    <div>
      <Label className="mb-2 block text-xs font-medium text-zinc-400">
        Per-App Model
      </Label>
      <div className="space-y-2">
        {APP_MODEL_KEYS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs text-zinc-400">{label}</span>
            <select
              value={agentModels?.[key]?.model ?? ''}
              onChange={(e) => handleChange(key, e.target.value)}
              disabled={saveAgentModels.isPending}
              className="h-7 flex-1 rounded-md border border-white/[0.1] bg-white/[0.04] px-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            >
              <option value="">Default model</option>
              {providers.flatMap((p) =>
                p.models.map((m) => (
                  <option key={`${p.id}/${m.id}`} value={`${p.id}/${m.id}`}>
                    {p.name || p.id} / {m.name || m.id}
                  </option>
                ))
              )}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OpenCodeSettings() {
  const queryClient = useQueryClient()
  const serverUrl = useOpenCodeStore((s) => s.serverUrl)
  const setServerUrl = useOpenCodeStore((s) => s.setServerUrl)
  const [urlInput, setUrlInput] = useState(serverUrl)

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useOpenCodeStatus()
  const { data: providers, isLoading: providersLoading, refetch: refetchProviders } = useOpenCodeProviders()

  const connected = status?.connected === true

  const handleTestConnection = async () => {
    if (urlInput !== serverUrl) {
      setServerUrl(urlInput)
    }
    const result = await refetchStatus()
    if (result.data?.connected) {
      toast.success('Connected to OpenCode server')
    } else {
      toast.error(result.data?.error || 'Cannot connect to OpenCode server')
    }
  }

  const handleSyncModels = async () => {
    await queryClient.invalidateQueries({ queryKey: ['opencode', 'providers'] })
    const result = await refetchProviders()
    if (result.error) {
      toast.error('Failed to refresh models')
    } else {
      toast.success('Models refreshed from OpenCode')
    }
  }

  const handleUrlBlur = () => {
    if (urlInput !== serverUrl) {
      setServerUrl(urlInput)
    }
  }

  const tokenStats = useAllSessionsTokens()
  const totalModels = providers?.reduce((sum, p) => sum + p.models.length, 0) ?? 0

  const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Cpu size={16} />
            OpenCode
          </CardTitle>
          <Badge variant={connected ? 'success' : 'danger'} className="flex items-center gap-1.5">
            {connected ? (
              <>
                <Circle size={8} className="fill-emerald-400 text-emerald-400" />
                Connected
              </>
            ) : (
              <>
                <Circle size={8} className="fill-red-400 text-red-400" />
                Disconnected
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Server URL */}
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-zinc-400">
            Server URL
          </Label>
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="http://localhost:4096"
              className="flex-1"
            />
            <Button
              size="sm"
              variant="default"
              onClick={handleTestConnection}
              disabled={statusLoading}
            >
              {statusLoading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : connected ? (
                <Wifi size={14} />
              ) : (
                <WifiOff size={14} />
              )}
              Test Connection
            </Button>
          </div>
          {status?.error && (
            <p className="mt-1.5 text-xs text-red-400">{status.error}</p>
          )}
        </div>

        {/* Discovered Providers & Models — single dropdown */}
        {connected && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs font-medium text-zinc-400">
                Models
                {totalModels > 0 && (
                  <span className="ml-1.5 text-zinc-500">
                    ({providers?.length} provider{providers!.length !== 1 ? 's' : ''}, {totalModels} model{totalModels !== 1 ? 's' : ''})
                  </span>
                )}
              </Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSyncModels}
                disabled={providersLoading}
              >
                <RefreshCw size={14} className={providersLoading ? 'animate-spin' : ''} />
                Sync
              </Button>
            </div>

            {providersLoading ? (
              <p className="text-xs text-zinc-500">Loading...</p>
            ) : providers && providers.length > 0 ? (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <button className="group flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left transition-colors hover:bg-white/[0.05]">
                    <ChevronDown size={12} className="shrink-0 text-zinc-500 transition-transform group-data-[state=closed]:rotate-[-90deg]" />
                    <span className="text-xs text-zinc-300">
                      {providers.length} provider{providers.length !== 1 ? 's' : ''}, {totalModels} model{totalModels !== 1 ? 's' : ''}
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
                    {providers.map((provider) => (
                      <div key={provider.id}>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                          {provider.name || provider.id}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {provider.models.map((model) => (
                            <Badge key={model.id} variant="default" className="text-[11px]">
                              {model.name || model.id}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <p className="text-xs text-zinc-500">No providers discovered</p>
            )}
          </div>
        )}

        {/* Per-App Model Selection */}
        {connected && providers && providers.length > 0 && (
          <PerAppModelSelectors providers={providers} />
        )}

        {/* Token Usage Summary */}
        {connected && tokenStats.sessionCount > 0 && (
          <div>
            <Label className="mb-2 block text-xs font-medium text-zinc-400">
              Token Usage
            </Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <Hash size={14} className="mx-auto mb-1 text-indigo-400" />
                <p className="text-sm font-semibold text-zinc-200">{tokenStats.sessionCount}</p>
                <p className="text-[11px] text-zinc-500">Sessions</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <Zap size={14} className="mx-auto mb-1 text-emerald-400" />
                <p className="text-sm font-semibold text-zinc-200">{formatTokens(tokenStats.total)}</p>
                <p className="text-[11px] text-zinc-500">Tokens</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <DollarSign size={14} className="mx-auto mb-1 text-amber-400" />
                <p className="text-sm font-semibold text-zinc-200">
                  {tokenStats.cost > 0 ? `$${tokenStats.cost.toFixed(4)}` : '$0.00'}
                </p>
                <p className="text-[11px] text-zinc-500">Cost</p>
              </div>
            </div>
            {tokenStats.models.length > 0 && (
              <p className="mt-2 text-xs text-zinc-500">
                Models: {tokenStats.models.join(', ')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

