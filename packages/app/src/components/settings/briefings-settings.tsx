import { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Combobox } from '@/components/ui/combobox'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { SchedulePicker } from '@/components/settings/schedule-picker'
import { CalendarClock, Save, Play, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useBriefingConfig, useUpdateBriefingConfig, useTriggerBriefing } from '@/hooks/useBot'
import { listConfig, setConfig } from '@/services/config'
import type { BriefingConfig, BriefingCheckItem } from '@zync/shared/types'

function ItemChecklist({
  items,
  onChange,
}: {
  items: BriefingCheckItem[]
  onChange: (items: BriefingCheckItem[]) => void
}) {
  const toggle = (id: string) => {
    onChange(items.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i))
  }

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => toggle(item.id)}
            className={`h-4 w-4 shrink-0 rounded border ${item.enabled ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-600'}`}
          />
          <span className="text-sm text-zinc-300">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function BriefingSection({
  title,
  items,
  instructions,
  onItemsChange,
  onInstructionsChange,
}: {
  title: string
  items: BriefingCheckItem[]
  instructions: string
  onItemsChange: (items: BriefingCheckItem[]) => void
  onInstructionsChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/[0.04] transition-colors">
        <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        {title}
        <span className="ml-auto text-xs text-zinc-500">
          {items.filter(i => i.enabled).length}/{items.length} items
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Include in briefing</label>
            <ItemChecklist items={items} onChange={onItemsChange} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Custom instructions</label>
            <Textarea
              value={instructions}
              onChange={(e) => onInstructionsChange(e.target.value)}
              placeholder="e.g. Always mention deadlines. Focus on high-priority items."
              rows={3}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function BriefingsSettingsCard() {
  const { data: config, isLoading } = useBriefingConfig()
  const updateConfig = useUpdateBriefingConfig()
  const triggerBriefing = useTriggerBriefing()

  const [draft, setDraft] = useState<BriefingConfig | null>(null)
  const [timezone, setTimezone] = useState(() =>
    Intl.DateTimeFormat().resolvedOptions().timeZone
  )

  const timezoneOptions = useMemo(() =>
    Intl.supportedValuesOf('timeZone').map(tz => ({
      value: tz,
      label: tz.replace(/_/g, ' '),
    })),
    []
  )

  useEffect(() => {
    if (config && !draft) setDraft(config)
  }, [config])

  useEffect(() => {
    listConfig('briefing').then(configs => {
      const tz = configs.find(c => c.key === 'SCHEDULE_TIMEZONE')
      if (tz) setTimezone(tz.value)
    }).catch(() => {})
  }, [])

  const handleSave = () => {
    if (!draft) return
    updateConfig.mutate(draft, {
      onSuccess: () => {
        setConfig('SCHEDULE_TIMEZONE', timezone, 'briefing')
        toast.success('Briefing config saved')
      },
      onError: () => toast.error('Failed to save briefing config'),
    })
  }

  const handleTrigger = (type: 'morning' | 'evening') => {
    triggerBriefing.mutate(type, {
      onSuccess: () => toast.success(`${type === 'morning' ? 'Morning briefing' : 'Evening recap'} triggered`),
      onError: () => toast.error('Failed to trigger briefing'),
    })
  }

  if (isLoading || !draft) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock size={16} />
          Proactive Briefings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
            className={`h-4 w-4 shrink-0 rounded border ${draft.enabled ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-600'}`}
          />
          <span className="text-sm text-zinc-300">Enabled</span>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Timezone</label>
          <Combobox
            options={timezoneOptions}
            value={timezone}
            onChange={setTimezone}
            placeholder="Select timezone..."
            searchPlaceholder="Search timezones..."
          />
          <p className="mt-1 text-xs text-zinc-500">All schedules run in this timezone</p>
        </div>

        <SchedulePicker
          label="Morning Schedule"
          value={draft.morningCron}
          onChange={(v) => setDraft({ ...draft, morningCron: v })}
        />
        <SchedulePicker
          label="Evening Schedule"
          value={draft.eveningCron}
          onChange={(v) => setDraft({ ...draft, eveningCron: v })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Channel</label>
            <Input
              value={draft.channel}
              onChange={(e) => setDraft({ ...draft, channel: e.target.value })}
              placeholder="telegram"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Chat ID</label>
            <Input
              value={draft.chatId}
              onChange={(e) => setDraft({ ...draft, chatId: e.target.value })}
              placeholder="Auto-captured from Telegram"
              className={draft.chatId ? 'text-zinc-300' : 'text-zinc-500'}
            />
            <p className="mt-1 text-xs text-zinc-500">
              {draft.chatId
                ? 'Captured from your Telegram chat'
                : 'Send any message to your Telegram bot to auto-capture'}
            </p>
          </div>
        </div>

        <BriefingSection
          title="Morning Briefing"
          items={draft.morningItems}
          instructions={draft.morningInstructions}
          onItemsChange={(items) => setDraft({ ...draft, morningItems: items })}
          onInstructionsChange={(v) => setDraft({ ...draft, morningInstructions: v })}
        />

        <BriefingSection
          title="Evening Recap"
          items={draft.eveningItems}
          instructions={draft.eveningInstructions}
          onItemsChange={(items) => setDraft({ ...draft, eveningItems: items })}
          onInstructionsChange={(v) => setDraft({ ...draft, eveningInstructions: v })}
        />

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={updateConfig.isPending}>
            <Save size={14} className="mr-1.5" />
            {updateConfig.isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" variant="default" onClick={() => handleTrigger('morning')} disabled={triggerBriefing.isPending}>
            <Play size={14} className="mr-1.5" />
            Morning
          </Button>
          <Button size="sm" variant="default" onClick={() => handleTrigger('evening')} disabled={triggerBriefing.isPending}>
            <Play size={14} className="mr-1.5" />
            Evening
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
