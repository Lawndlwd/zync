import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Zap, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useBotSkills, useReloadSkills } from '@/hooks/useBot'

export function SkillsSettingsCard() {
  const { data: skills, isLoading } = useBotSkills()
  const reloadSkills = useReloadSkills()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap size={16} />
            Skills
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => reloadSkills.mutate(undefined, {
              onSuccess: (data) => toast.success(`Reloaded ${data.count} skill(s)`),
              onError: () => toast.error('Failed to reload skills'),
            })}
            disabled={reloadSkills.isPending}
          >
            <RefreshCw size={14} className={reloadSkills.isPending ? 'animate-spin' : ''} />
            <span className="ml-1.5 hidden sm:inline">Reload</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : !skills?.length ? (
          <p className="text-sm text-zinc-500">No skills loaded.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {skills.map((s) => (
              <div key={s.name} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                <p className="text-sm font-medium text-zinc-300">{s.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{s.description}</p>
                {s.triggers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.triggers.map((t) => (
                      <Badge key={t} variant="default" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
