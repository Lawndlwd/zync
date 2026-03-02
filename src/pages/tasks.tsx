import { useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { KanbanBoard } from '@/components/projects/kanban-board'
import { ProjectGrid } from '@/components/projects/project-grid'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectDetail } from '@/components/projects/project-detail'
import { TaskDrawer } from '@/components/projects/task-drawer'
import { CreateTaskDialog } from '@/components/projects/create-task-dialog'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { useAllTasks, useUpdateTaskStatus } from '@/hooks/useTasks'
import { useProjects, useDeleteProject } from '@/hooks/useProjects'
import type { Task, TaskStatus } from '@/types/project'
import { Plus, User, Bot, ChevronDown } from 'lucide-react'

type AssigneeFilter = 'all' | '@me' | '@ai'
type PriorityFilter = 'all' | 'high' | 'medium' | 'low'

const assigneeFilters: { label: string; value: AssigneeFilter; icon?: typeof User }[] = [
  { label: 'All', value: 'all' },
  { label: '@me', value: '@me', icon: User },
  { label: '@ai', value: '@ai', icon: Bot },
]

const priorityFilters: { label: string; value: PriorityFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
]

export function TasksPage() {
  const { projectName } = useParams<{ projectName?: string }>()
  const navigate = useNavigate()

  // Filters
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')

  // Create dropdown
  const [createMenuOpen, setCreateMenuOpen] = useState(false)

  // Dialogs
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)

  // Task drawer
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Data
  const { data: allTasks = [], isLoading: tasksLoading } = useAllTasks()
  const { data: projects = [] } = useProjects()
  const updateTaskStatus = useUpdateTaskStatus()
  const deleteProject = useDeleteProject()

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let tasks = allTasks
    if (assigneeFilter !== 'all') {
      tasks = tasks.filter((t) => t.metadata.assignee === assigneeFilter)
    }
    if (priorityFilter !== 'all') {
      tasks = tasks.filter((t) => t.metadata.priority === priorityFilter)
    }
    return tasks
  }, [allTasks, assigneeFilter, priorityFilter])

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

  const handleDeleteProject = useCallback(
    (name: string) => {
      deleteProject.mutate(name)
    },
    [deleteProject],
  )

  // If we have a projectName param, render the project detail view
  if (projectName) {
    return <ProjectDetail projectName={projectName} onBack={() => navigate('/tasks')} />
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Tasks &amp; Projects</h1>

        {/* Create dropdown */}
        <div className="relative">
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setCreateMenuOpen(!createMenuOpen)}
          >
            <Plus size={16} />
            Create
            <ChevronDown size={14} />
          </Button>

          {createMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setCreateMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-white/[0.1] bg-zinc-900 p-1 shadow-xl">
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] transition-colors"
                  onClick={() => {
                    setCreateMenuOpen(false)
                    setCreateTaskOpen(true)
                  }}
                >
                  New Task
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] transition-colors"
                  onClick={() => {
                    setCreateMenuOpen(false)
                    setCreateProjectOpen(true)
                  }}
                >
                  New Project
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filter bar */}


      {/* Main content: Kanban (3/4) + Projects sidebar (1/4) */}
      <div className="grid grid-cols-5 lg:flex-row gap-6">
        {/* Projects sidebar */}
        <div className="col-span-1 shrink-0">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-100">Projects</h2>
              <span className="text-sm text-zinc-500">({projects.length})</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCreateProjectOpen(true)}
            >
              <Plus size={16} />
            </Button>
          </div>

          <div className="space-y-2">
            {projects.length === 0 ? (
              <ProjectGrid
                projects={projects}
                onSelectProject={(name) => navigate(`/tasks/${name}`)}
                onDeleteProject={handleDeleteProject}
                onCreateProject={() => setCreateProjectOpen(true)}
              />
            ) : (
              projects.map((project) => (
                <ProjectCard
                  key={project.name}
                  project={project}
                  onClick={() => navigate(`/tasks/${project.name}`)}
                  onDelete={handleDeleteProject}
                  compact
                />
              ))
            )}
          </div>
        </div>
        {/* Kanban board — takes majority of space */}
        <div className="col-span-4">
          <div className="mb-4 flex gap-3 flex-wrap">
            {/* Assignee filters */}
            {assigneeFilters.map((f) => (
              <Button
                key={f.value}
                variant={assigneeFilter === f.value ? 'default' : 'ghost'}
                size="sm"
                className="gap-1.5"
                onClick={() => setAssigneeFilter(f.value)}
              >
                {f.icon && <f.icon size={14} />}
                {f.label}
              </Button>
            ))}

            <div className="w-px bg-white/[0.1] mx-1" />

            {/* Priority filters */}
            {priorityFilters.map((f) => (
              <Button
                key={f.value}
                variant={priorityFilter === f.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPriorityFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <KanbanBoard
            tasks={filteredTasks}
            onStatusChange={handleStatusChange}
            onSelectTask={handleSelectTask}
            showProject={true}
            isLoading={tasksLoading}
          />
        </div>


      </div>

      {/* Task drawer */}
      <TaskDrawer
        task={selectedTask}
        open={drawerOpen}
        onClose={handleCloseDrawer}
      />

      {/* Create dialogs */}
      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
      />

      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
      />
    </div>
  )
}
