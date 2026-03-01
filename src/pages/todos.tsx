import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchTodos, createTodo, updateTodo, deleteTodo } from '@/services/todos'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import type { TodoPriority, TodoStatus } from '@/types/todo'
import { cn } from '@/lib/utils'
import { Plus, Check, Trash2, GripVertical, Loader2 } from 'lucide-react'

const priorityColors: Record<TodoPriority, string> = {
  P1: 'danger',
  P2: 'warning',
  P3: 'info',
  P4: 'default',
}

const statusFilters: { label: string; value: TodoStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Done', value: 'done' },
]

export function TodosPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<TodoStatus | 'all'>('all')
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<TodoPriority>('P3')
  const [showForm, setShowForm] = useState(false)

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
  })

  const addMutation = useMutation({
    mutationFn: createTodo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & Record<string, unknown>) =>
      updateTodo(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTodo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })

  const filtered = filter === 'all' ? todos : todos.filter((t) => t.status === filter)
  const sorted = [...filtered].sort((a, b) => a.order - b.order)

  const handleAdd = () => {
    if (!newTitle.trim()) return
    addMutation.mutate({
      title: newTitle.trim(),
      description: '',
      linkedIssue: null,
      priority: newPriority,
      dueDate: null,
    })
    setNewTitle('')
    setShowForm(false)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">To-Do List</h1>
          <p className="text-base text-zinc-500">{todos.filter((t) => t.status !== 'done').length} pending</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} />
          Add To-Do
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        {statusFilters.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <Card className="mb-4 p-4">
          <div className="flex gap-3">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What needs to be done?"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              autoFocus
            />
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as TodoPriority)}
              className="h-9 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-base text-zinc-300"
            >
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
              <option value="P4">P4</option>
            </select>
            <Button onClick={handleAdd} disabled={addMutation.isPending}>
              {addMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : 'Add'}
            </Button>
          </div>
        </Card>
      )}

      {/* List */}
      <ErrorBoundary>
        <div className="space-y-3">
          {isLoading && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
              <Loader2 size={24} className="mx-auto animate-spin text-zinc-500" />
            </div>
          )}
          {!isLoading && sorted.length === 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
              <p className="text-base text-zinc-500">No to-dos yet. Add one above!</p>
            </div>
          )}
          {sorted.map((todo) => (
            <Card key={todo.id} className="flex items-center gap-3 p-4">
              <GripVertical size={18} className="text-zinc-600 cursor-grab" />
              <button
                onClick={() =>
                  updateMutation.mutate({
                    id: todo.id,
                    status: todo.status === 'done' ? 'open' : 'done',
                  })
                }
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors',
                  todo.status === 'done'
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-zinc-600 hover:border-zinc-400'
                )}
              >
                {todo.status === 'done' && <Check size={16} />}
              </button>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-base',
                    todo.status === 'done' ? 'text-zinc-500 line-through' : 'text-zinc-200'
                  )}
                >
                  {todo.title}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <Badge variant={priorityColors[todo.priority] as 'danger' | 'warning' | 'info' | 'default'}>
                    {todo.priority}
                  </Badge>
                  {todo.linkedIssue && (
                    <span className="text-sm font-mono text-indigo-400">{todo.linkedIssue}</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteMutation.mutate(todo.id)}
                className="text-zinc-600 hover:text-red-400"
              >
                <Trash2 size={18} />
              </Button>
            </Card>
          ))}
        </div>
      </ErrorBoundary>
    </div>
  )
}
