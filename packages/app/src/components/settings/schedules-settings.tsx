import cronstrue from 'cronstrue'
import { Clock, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { SchedulePicker } from '@/components/settings/schedule-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBotSchedules, useCreateSchedule, useDeleteSchedule, useToggleSchedule } from '@/hooks/useBot'

export function SchedulesSettingsCard() {
  const [cronExpr, setCronExpr] = useState('0 9 * * 1-5')
  const [prompt, setPrompt] = useState('')
  const [chatId, setChatId] = useState('')

  const { data: schedules, isLoading } = useBotSchedules()
  const createSchedule = useCreateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const toggleSchedule = useToggleSchedule()

  const handleAdd = () => {
    if (!cronExpr.trim() || !prompt.trim() || !chatId.trim()) return
    createSchedule.mutate(
      { cronExpression: cronExpr.trim(), prompt: prompt.trim(), chatId: parseInt(chatId, 10) },
      {
        onSuccess: () => {
          setCronExpr('')
          setPrompt('')
          setChatId('')
          toast.success('Schedule created')
        },
        onError: () => toast.error('Failed to create schedule'),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock size={16} />
          Agent Schedules
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <SchedulePicker value={cronExpr} onChange={setCronExpr} />
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Prompt..."
              className="sm:col-span-2"
            />
            <div className="flex gap-2">
              <Input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Chat ID" type="number" />
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!cronExpr.trim() || !prompt.trim() || !chatId.trim() || createSchedule.isPending}
              >
                <Plus size={14} />
              </Button>
            </div>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !schedules?.length ? (
            <p className="text-sm text-muted-foreground">No schedules.</p>
          ) : (
            schedules.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary p-3">
                <button
                  onClick={() => toggleSchedule.mutate({ id: s.id, enabled: !s.enabled })}
                  className={`h-4 w-4 shrink-0 rounded border ${
                    s.enabled ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{s.prompt}</p>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      try {
                        return cronstrue.toString(s.cron_expression, { use24HourTimeFormat: false })
                      } catch {
                        return s.cron_expression
                      }
                    })()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-400"
                  onClick={() =>
                    deleteSchedule.mutate(s.id, {
                      onSuccess: () => toast.success('Schedule deleted'),
                      onError: () => toast.error('Failed to delete'),
                    })
                  }
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
