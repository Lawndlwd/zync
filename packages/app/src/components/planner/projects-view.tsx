import type { GoalGranularity } from '@zync/shared/types'
import { Layers, Plus, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EditorContainer } from '@/components/blocksuite/components/EditorContainer'
import { EditorProvider } from '@/components/blocksuite/components/EditorProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useGoalDatabaseSync } from '@/hooks/useGoalDatabaseSync'
import { useDeleteGoal, useGoal, useGoalChildren, useGoalRoots, useScaffoldGoalChildren } from '@/hooks/useGoals'
import { CreateGoalDialog } from './create-goal-dialog'
import { GoalTaskList } from './goal-task-list'
import { ProjectsBreadcrumb } from './projects-breadcrumb'

const NEXT_GRANULARITY: Record<string, GoalGranularity> = {
  year: 'month',
  month: 'week',
  week: 'day',
}

const SCAFFOLD_LABELS: Record<string, string> = {
  year: 'Generate Months',
  month: 'Generate Weeks',
  week: 'Generate Days',
}

export function ProjectsView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const goalId = searchParams.get('g')

  const navigate = (id: string | null) => {
    if (id) {
      setSearchParams({ g: id })
    } else {
      setSearchParams({})
    }
  }

  if (goalId) {
    return <GoalDrillDown key={goalId} goalId={goalId} onNavigate={navigate} />
  }

  return <GoalRootList onNavigate={navigate} />
}

// ============================================================
// Root list — year goals
// ============================================================

function GoalRootList({ onNavigate }: { onNavigate: (id: string | null) => void }) {
  const { data: roots = [] } = useGoalRoots()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Target size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Projects</h2>
            <p className="text-xs text-muted-foreground">Year goals — your missions</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5">
          <Plus size={14} />
          New Year Goal
        </Button>
      </div>

      {roots.length === 0 ? (
        <Card className="gap-0 border-border bg-secondary py-0">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Target size={40} className="mb-3 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">No year goals yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Create your first mission to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roots.map((goal) => (
            <Card
              key={goal.id}
              className="group gap-0 cursor-pointer border-border bg-secondary py-0 transition-all hover:border-border hover:bg-accent"
              onClick={() => onNavigate(goal.id)}
            >
              <CardContent className="p-5">
                <h3 className="text-base font-semibold text-foreground">{goal.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {goal.startDate} — {goal.endDate}
                </p>
                {goal.progress > 0 && (
                  <div className="mt-3 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-[#ff5737]"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateGoalDialog open={showCreate} onOpenChange={setShowCreate} granularity="year" />
    </div>
  )
}

// ============================================================
// Drill-down view — full-page editor with database table inside
// ============================================================

function GoalDrillDown({ goalId, onNavigate }: { goalId: string; onNavigate: (id: string | null) => void }) {
  const { data } = useGoal(goalId)
  const { data: children = [] } = useGoalChildren(goalId)
  const scaffold = useScaffoldGoalChildren()
  const deleteGoal = useDeleteGoal()
  const [showCreateChild, setShowCreateChild] = useState(false)

  if (!data) return null

  const { goal, ancestors } = data
  const isDay = goal.granularity === 'day'
  const nextGranularity = NEXT_GRANULARITY[goal.granularity]

  const handleDelete = () => {
    const parentId = goal.parentId
    deleteGoal.mutate(goal.id, { onSuccess: () => onNavigate(parentId) })
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Breadcrumb */}
      <ProjectsBreadcrumb ancestors={ancestors} currentTitle={goal.title} onNavigate={onNavigate} />

      {/* Header — metadata + actions only, title lives in BlockSuite */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
            {goal.granularity}
          </span>
          <span>
            {goal.startDate} — {goal.endDate}
          </span>
          {goal.progress > 0 && <span>{goal.progress}% complete</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isDay && nextGranularity && children.length === 0 && (
            <Button size="sm" variant="outline" onClick={() => scaffold.mutate(goalId)} disabled={scaffold.isPending}>
              <Layers size={14} className="mr-1.5" />
              {SCAFFOLD_LABELS[goal.granularity]}
            </Button>
          )}
          {!isDay && nextGranularity && (
            <Button size="sm" variant="ghost" onClick={() => setShowCreateChild(true)}>
              <Plus size={14} />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* BlockSuite editor — THE MAIN AREA
          The database table for children lives INSIDE this editor as an affine:database block.
          The sync hook populates it from server data. */}
      {goal.pageId && (
        <div className="blocksuite-editor-compact min-h-[calc(100vh-280px)]">
          <EditorProvider pageId={goal.pageId} title={goal.title}>
            <GoalEditorWithSync goalId={goalId} granularity={goal.granularity} onNavigate={onNavigate}>
              {children}
            </GoalEditorWithSync>
          </EditorProvider>
        </div>
      )}

      {/* Day level: tasks below editor */}
      {isDay && <GoalTaskList goalId={goalId} />}

      {/* Create child dialog */}
      {nextGranularity && (
        <CreateGoalDialog
          open={showCreateChild}
          onOpenChange={setShowCreateChild}
          parentId={goalId}
          granularity={nextGranularity}
        />
      )}
    </div>
  )
}

/** Inner component that has access to EditorContext for the sync hook */
function GoalEditorWithSync({
  goalId,
  granularity,
  children,
  onNavigate,
}: {
  goalId: string
  granularity: GoalGranularity
  children: any[]
  onNavigate: (id: string | null) => void
}) {
  // Sync server children into the BlockSuite database block
  useGoalDatabaseSync({
    goalId,
    granularity,
    children,
    onNavigate: (id) => onNavigate(id),
  })

  return <EditorContainer compact autoFocus />
}
