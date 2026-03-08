import { useSettingsStore } from '@/store/settings'
import { fetchServerSettings } from '@/services/settings'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { BoardPicker } from '@/components/jira/board-picker'
import { SettingField } from './setting-field'

export function JiraSettingsCard({ envConfig }: { envConfig: Awaited<ReturnType<typeof fetchServerSettings>> | null }) {
  const { settings, updateJira } = useSettingsStore()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jira Configuration</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <SettingField
          label="Base URL"
          value={settings.jira.baseUrl}
          onChange={(v) => updateJira({ baseUrl: v })}
          placeholder="https://your-domain.atlassian.net"
          envValue={envConfig?.jira.baseUrl}
        />
        <SettingField
          label="Email"
          value={settings.jira.email}
          onChange={(v) => updateJira({ email: v })}
          placeholder="you@company.com"
          envValue={envConfig?.jira.email}
        />
        <SettingField
          label="Project Key"
          value={settings.jira.projectKey}
          onChange={(v) => updateJira({ projectKey: v })}
          placeholder="PROJ"
          envValue={envConfig?.jira.projectKey}
        />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Board</label>
          <BoardPicker
            value={settings.jira.boardId}
            onChange={(id) => updateJira({ boardId: id })}
          />
        </div>
        <div className="sm:col-span-2">
          <SettingField
            label="Default JQL"
            value={settings.jira.defaultJql}
            onChange={(v) => updateJira({ defaultJql: v })}
            placeholder="assignee = currentUser() ORDER BY updated DESC"
          />
        </div>
      </CardContent>
    </Card>
  )
}
