import { useState, useMemo, useCallback, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
} from '@dnd-kit/core'
import { Skeleton } from '@/components/ui/skeleton'
import { KanbanColumn } from './kanban-column'
import { TaskCardOverlay } from './task-card'
import type { Task, TaskStatus } from '@zync/shared/types'

interface KanbanBoardProps {
  tasks: Task[]
  onStatusChange: (task: Task, newStatus: TaskStatus) => void
  onSelectTask: (task: Task) => void
  showProject?: boolean
  isLoading?: boolean
}

const columns: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'todo', title: 'To Do', color: 'zinc' },
  { id: 'in-progress', title: 'In Progress', color: 'blue' },
  { id: 'completed', title: 'Completed', color: 'emerald' },
]

const columnIds = new Set<string>(['todo', 'in-progress', 'completed'])

// Custom collision detection: only match column droppables, not task cards
const columnOnlyCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  const columnHit = pointerCollisions.find((c) => columnIds.has(c.id as string))
  if (columnHit) return [columnHit]

  const rectCollisions = rectIntersection(args)
  const rectColumnHit = rectCollisions.find((c) => columnIds.has(c.id as string))
  if (rectColumnHit) return [rectColumnHit]

  return []
}

// Disable the default drop animation so the overlay doesn't fly back
const noDropAnimation = { duration: 0, easing: '' as const, sideEffects: () => () => {} }

export function KanbanBoard({
  tasks,
  onStatusChange,
  onSelectTask,
  showProject,
  isLoading,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  // Local override: instantly moves the task to the new column on drop,
  // bypassing any cache/query timing. Cleared when props.tasks catches up.
  const [localMove, setLocalMove] = useState<{ taskId: string; newStatus: TaskStatus } | null>(null)
  const prevTasksRef = useRef(tasks)

  // Clear localMove once the upstream tasks reflect the change
  if (tasks !== prevTasksRef.current) {
    prevTasksRef.current = tasks
    if (localMove) setLocalMove(null)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  // Apply the local override on top of the query data
  const effectiveTasks = useMemo(() => {
    if (!localMove) return tasks
    return tasks.map((t) =>
      `${t.project}/${t.fileName}` === localMove.taskId
        ? { ...t, metadata: { ...t.metadata, status: localMove.newStatus } }
        : t
    )
  }, [tasks, localMove])

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      todo: [],
      'in-progress': [],
      completed: [],
    }
    for (const t of effectiveTasks) {
      const status = t.metadata.status
      if (map[status]) {
        map[status].push(t)
      } else {
        map.todo.push(t)
      }
    }
    return map
  }, [effectiveTasks])

  const findTaskById = useCallback(
    (id: string): Task | undefined =>
      tasks.find((t) => `${t.project}/${t.fileName}` === id),
    [tasks],
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = findTaskById(event.active.id as string)
      setActiveTask(task ?? null)
    },
    [findTaskById],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over) {
        const task = findTaskById(active.id as string)
        if (task) {
          const newStatus = over.id as TaskStatus
          if (columnIds.has(newStatus) && task.metadata.status !== newStatus) {
            // Apply the move instantly via local state — no flicker
            setLocalMove({ taskId: active.id as string, newStatus })
            // Fire the actual mutation (cache + server)
            onStatusChange(task, newStatus)
          }
        }
      }

      setActiveTask(null)
    },
    [findTaskById, onStatusChange],
  )

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto">
        {columns.map((col) => (
          <div key={col.id} className="flex-1 min-w-[280px] flex flex-col gap-3">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={columnOnlyCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            color={col.color}
            tasks={grouped[col.id]}
            onSelectTask={onSelectTask}
            showProject={showProject}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={noDropAnimation}>
        {activeTask ? (
          <TaskCardOverlay task={activeTask} showProject={showProject} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
