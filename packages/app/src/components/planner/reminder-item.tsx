import type { PlannerReminder } from '@zync/shared/types'
import { format, isPast } from 'date-fns'
import { Bell, Check, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDeleteReminder, useUpdateReminder } from '@/hooks/usePlanner'
import { cn } from '@/lib/utils'

interface ReminderItemProps {
  reminder: PlannerReminder
}

export function ReminderItem({ reminder }: ReminderItemProps) {
  const updateReminder = useUpdateReminder()
  const deleteReminder = useDeleteReminder()

  const overdue = !reminder.completed && isPast(new Date(reminder.dueAt))

  return (
    <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary">
      <button
        onClick={() => updateReminder.mutate({ id: reminder.id, completed: !reminder.completed })}
        className={cn(
          'shrink-0 transition-colors',
          reminder.completed
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400',
        )}
      >
        {reminder.completed ? <Check size={16} /> : <Bell size={16} />}
      </button>
      <div className="flex-1 min-w-0">
        <span className={cn('text-sm', reminder.completed ? 'text-muted-foreground line-through' : 'text-foreground')}>
          {reminder.title}
        </span>
      </div>
      <Badge variant={overdue ? 'danger' : 'default'}>{format(new Date(reminder.dueAt), 'MMM d, HH:mm')}</Badge>
      <Button
        variant="ghost"
        size="xs"
        className="opacity-0 group-hover:opacity-100"
        onClick={() => deleteReminder.mutate(reminder.id)}
      >
        <Trash2 size={13} className="text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  )
}
