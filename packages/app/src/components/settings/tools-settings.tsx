import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Wrench, Save, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

interface McpToolGroup {
  id: string
  label: string
  toolCount: number
  alwaysOn: boolean
  enabled: boolean
}

async function fetchMcpTools(): Promise<{ groups: McpToolGroup[] }> {
  const res = await fetch('/api/settings/mcp-tools')
  if (!res.ok) throw new Error('Failed to fetch MCP tools config')
  return res.json()
}

async function saveMcpTools(enabledGroups: string[]): Promise<void> {
  const res = await fetch('/api/settings/mcp-tools', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabledGroups }),
  })
  if (!res.ok) throw new Error('Failed to save MCP tools config')
}

export function ToolsSettingsCard() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['mcp-tools'],
    queryFn: fetchMcpTools,
  })

  const [localState, setLocalState] = useState<Record<string, boolean>>({})
  const hasChanges = Object.keys(localState).length > 0

  const mutation = useMutation({
    mutationFn: saveMcpTools,
    onSuccess: () => {
      toast.success('MCP tools updated — server restarting')
      setLocalState({})
      queryClient.invalidateQueries({ queryKey: ['mcp-tools'] })
      queryClient.invalidateQueries({ queryKey: ['bot-tools'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const getEnabled = (group: McpToolGroup) => {
    if (group.alwaysOn) return true
    return localState[group.id] ?? group.enabled
  }

  const toggleGroup = (id: string, currentEnabled: boolean) => {
    setLocalState(prev => ({ ...prev, [id]: !currentEnabled }))
  }

  const handleSave = () => {
    if (!data) return
    const enabledGroups = data.groups
      .filter(g => !g.alwaysOn && getEnabled(g))
      .map(g => g.id)
    mutation.mutate(enabledGroups)
  }

  const totalTools = data?.groups.reduce((sum, g) => getEnabled(g) ? sum + g.toolCount : sum, 0) ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench size={16} />
          MCP Tool Groups
          {data && <Badge className="text-[10px] ml-2">{totalTools} tools</Badge>}
        </CardTitle>
        <p className="text-xs text-zinc-500">Enable or disable tool groups for the MCP server. Changes restart the MCP process.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : !data?.groups.length ? (
            <p className="text-sm text-zinc-500">No tool groups found.</p>
          ) : (
            data.groups.map((g) => {
              const enabled = getEnabled(g)
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={g.alwaysOn}
                  onClick={() => !g.alwaysOn && toggleGroup(g.id, enabled)}
                  className="flex w-full items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06] disabled:opacity-60 disabled:cursor-default"
                >
                  <div className={`h-4 w-7 rounded-full transition-colors ${enabled ? 'bg-indigo-500' : 'bg-zinc-700'} relative`}>
                    <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${enabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-300">{g.label}</p>
                      {g.alwaysOn && <Badge variant="info" className="text-[9px]">always on</Badge>}
                    </div>
                  </div>
                  <Badge className="text-[10px]">{g.toolCount}</Badge>
                </button>
              )
            })
          )}
        </div>
        {hasChanges && (
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
              <Save size={14} className="mr-1.5" />
              {mutation.isPending ? 'Saving...' : 'Save & Restart MCP'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLocalState({})}>
              <RotateCcw size={14} className="mr-1.5" />
              Reset
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
