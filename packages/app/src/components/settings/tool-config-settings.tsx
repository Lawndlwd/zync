import type { ToolConfig } from '@zync/shared/types'
import { Save, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TagInput } from '@/components/ui/tag-input'
import { useBotToolConfig, useUpdateToolConfig } from '@/hooks/useBot'

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
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Shell Allowlist</label>
          <p className="mb-2 text-xs text-muted-foreground">Commands the AI agent can execute.</p>
          <TagInput
            value={draft.shell.allowlist}
            onChange={(allowlist) => setDraft({ ...draft, shell: { ...draft.shell, allowlist } })}
            placeholder="Add command..."
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">File Allowed Paths</label>
          <p className="mb-2 text-xs text-muted-foreground">Directories the AI agent can read/write.</p>
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
