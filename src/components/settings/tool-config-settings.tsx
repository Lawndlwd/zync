import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TagInput } from '@/components/ui/tag-input'
import { Shield, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useBotToolConfig, useUpdateToolConfig } from '@/hooks/useBot'
import type { ToolConfig } from '@/types/bot'

export function ToolConfigSettingsCard() {
  const { data: config, isLoading } = useBotToolConfig()
  const updateConfig = useUpdateToolConfig()

  const [draft, setDraft] = useState<ToolConfig | null>(null)

  useEffect(() => {
    if (config && !draft) setDraft(config)
  }, [config])

  const handleSave = () => {
    if (!draft) return
    updateConfig.mutate(draft, {
      onSuccess: () => toast.success('Tool config saved'),
      onError: () => toast.error('Failed to save tool config'),
    })
  }

  if (isLoading || !draft) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield size={16} />
          Tool Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Shell Allowlist</label>
          <p className="mb-2 text-xs text-zinc-600">Commands the AI agent can execute.</p>
          <TagInput
            value={draft.shell.allowlist}
            onChange={(allowlist) => setDraft({ ...draft, shell: { ...draft.shell, allowlist } })}
            placeholder="Add command..."
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">File Allowed Paths</label>
          <p className="mb-2 text-xs text-zinc-600">Directories the AI agent can read/write.</p>
          <TagInput
            value={draft.files.allowed_paths}
            onChange={(allowed_paths) => setDraft({ ...draft, files: { ...draft.files, allowed_paths } })}
            placeholder="Add path..."
          />
        </div>
        <Button size="sm" onClick={handleSave} disabled={updateConfig.isPending}>
          <Save size={14} className="mr-1.5" />
          {updateConfig.isPending ? 'Saving...' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  )
}
