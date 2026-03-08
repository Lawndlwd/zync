import { useState, useCallback } from 'react'
import { ArrowLeft, Plus, Pencil, Save, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MilkdownEditor } from '@/components/ui/milkdown-editor'
import { MarkdownContent } from '@/components/ui/markdown'
import { KanbanBoard } from '@/components/projects/kanban-board'
import { TaskDrawer } from '@/components/projects/task-drawer'
import { CreateTaskDialog } from '@/components/projects/create-task-dialog'
import { getProjectIcon, getProjectColor } from '@/components/projects/project-card'
import { useProject, useUpdateProject } from '@/hooks/useProjects'
import { useProjectTasks } from '@/hooks/useTasks'
import { useUpdateTaskStatus } from '@/hooks/useTasks'
import type { Task, TaskStatus } from '@zync/shared/types'

interface ProjectDetailProps {
  projectName: string
  onBack: () => void
}

export function ProjectDetail({ projectName, onBack }: ProjectDetailProps) {
  const { data: project, isLoading: projectLoading } = useProject(projectName)
  const { data: tasks = [], isLoading: tasksLoading } = useProjectTasks(projectName)
  const updateProject = useUpdateProject()
  const updateTaskStatus = useUpdateTaskStatus()

  // Description editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')

  // Task drawer state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Create task dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const handleEditStart = useCallback(() => {
    setEditContent(project?.content ?? '')
    setIsEditing(true)
  }, [project])

  const handleEditSave = useCallback(() => {
    if (!project) return
    updateProject.mutate(
      { name: project.name, content: editContent },
      {
        onSuccess: () => setIsEditing(false),
      },
    )
  }, [project, editContent, updateProject])

  const handleEditCancel = useCallback(() => {
    setIsEditing(false)
    setEditContent('')
  }, [])

  const handleStatusChange = useCallback(
    (task: Task, newStatus: TaskStatus) => {
      updateTaskStatus.mutate({
        projectName: task.project,
        taskFile: task.fileName,
        status: newStatus,
      })
    },
    [updateTaskStatus],
  )

  const handleSelectTask = useCallback((task: Task) => {
    setSelectedTask(task)
    setDrawerOpen(true)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false)
  }, [])

  // Loading state
  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-zinc-500" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-zinc-500">Project not found.</p>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={16} className="mr-2" />
          Go back
        </Button>
      </div>
    )
  }

  const colors = getProjectColor(project.metadata.color)
  const Icon = getProjectIcon(project.metadata.icon)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={onBack}
          >
            <ArrowLeft size={18} className="text-zinc-400" />
          </Button>

          <div
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-lg',
              colors.bg,
            )}
          >
            <Icon size={20} className={colors.text} />
          </div>

          <div>
            <h1 className="text-xl font-bold text-zinc-100">
              {project.metadata.title || project.name}
            </h1>
            <p className="text-sm text-zinc-500">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          className="gap-2"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus size={16} />
          New Task
        </Button>
      </div>

      {/* Description section */}
      <div className="border-b border-white/[0.08] p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            Description
          </h2>
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 text-zinc-500 hover:text-zinc-300"
              onClick={handleEditStart}
            >
              <Pencil size={14} />
              Edit
            </Button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <MilkdownEditor
              value={editContent}
              onChange={setEditContent}
              placeholder="Write a project description..."
              minHeight="200px"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="gap-2"
                onClick={handleEditSave}
                disabled={updateProject.isPending}
              >
                {updateProject.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleEditCancel}
                disabled={updateProject.isPending}
              >
                <X size={14} />
                Cancel
              </Button>
            </div>
          </div>
        ) : project.content ? (
          <div className="prose-docs text-sm text-zinc-300">
            <MarkdownContent raw>{project.content}</MarkdownContent>
          </div>
        ) : (
          <p className="text-sm text-zinc-600 italic">
            No project description yet. Click edit to add one.
          </p>
        )}
      </div>

      {/* Kanban board section */}
      <div className="flex-1 p-6 overflow-auto">
        <KanbanBoard
          tasks={tasks}
          onStatusChange={handleStatusChange}
          onSelectTask={handleSelectTask}
          showProject={false}
          isLoading={tasksLoading}
        />
      </div>

      {/* Task drawer */}
      <TaskDrawer
        task={selectedTask}
        open={drawerOpen}
        onClose={handleCloseDrawer}
      />

      {/* Create task dialog */}
      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultProject={projectName}
      />
    </div>
  )
}
