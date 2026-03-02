import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Wrench } from 'lucide-react'
import { useBotTools } from '@/hooks/useBot'

export function ToolsSettingsCard() {
  const { data: tools, isLoading } = useBotTools()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench size={16} />
          Agent Tools
          {tools && <Badge variant="default" className="text-[10px] ml-2">{tools.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : !tools?.length ? (
            <p className="text-sm text-zinc-500">No tools available.</p>
          ) : (
            tools.map((t) => (
              <div key={t.name} className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-300">{t.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{t.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
