export type PlannerCategorySlug =
  | 'planning'
  | 'finances'
  | 'nutrition'
  | 'sport'
  | 'traveling'
  | 'resources'
  | 'archive'

export interface PlannerCategory {
  id: string
  slug: PlannerCategorySlug
  label: string
  icon: string
  color: string
  order: number
  createdAt: string
}

export interface PlannerNote {
  id: string
  categoryId: string
  title: string
  content: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export interface GoalMilestone {
  id: string
  title: string
  completed: boolean
  dueDate?: string
}

export interface PlannerGoal {
  id: string
  categoryId: string
  title: string
  description: string
  targetDate: string | null
  status: 'active' | 'completed' | 'abandoned'
  progress: number
  aiPlan: GoalMilestone[] | null
  createdAt: string
  updatedAt: string
}

export interface PlannerReminder {
  id: string
  title: string
  description: string
  dueAt: string
  repeat: 'daily' | 'weekly' | 'monthly' | null
  completed: boolean
  linkedGoalId: string | null
  linkedTodoId: string | null
  createdAt: string
}

export interface PlannerTransaction {
  id: string
  type: 'expense' | 'income'
  amount: number
  currency: string
  description: string
  category: string
  date: string
  recurring: boolean
  recurringInterval: string | null
  accountId: string | null
  createdAt: string
}

export interface PlannerAccount {
  id: string
  name: string
  type: 'bank' | 'cash' | 'crypto' | 'savings'
  balance: number
  currency: string
  icon: string
  createdAt: string
}

export interface PlannerDashboardStats {
  totalNotes: number
  activeGoals: number
  upcomingReminders: number
  tasksThisWeek: number
  habitsToday: number
}

// --- Databases (Notion-like) ---

export type DbColumnType = 'text' | 'number' | 'select' | 'multi-select' | 'date' | 'checkbox' | 'url'

export interface DbColumn {
  key: string
  type: DbColumnType
  label: string
  options?: string[] // for select / multi-select
}

export interface PlannerDatabase {
  id: string
  name: string
  icon: string
  schema: DbColumn[]
  categoryId: string
  createdAt: string
}

export interface PlannerDbItem {
  id: string
  databaseId: string
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type DbViewType = 'table' | 'kanban' | 'list'

export interface DbViewConfig {
  groupBy?: string // column key for kanban lanes
  sortBy?: string // column key
  sortDir?: 'asc' | 'desc'
  filters?: Array<{ column: string; op: string; value: string }>
}

export interface PlannerDbView {
  id: string
  databaseId: string
  name: string
  viewType: DbViewType
  config: DbViewConfig
  createdAt: string
}

// --- Life OS (Dan Koe Framework) ---

export type LifeOsComponentType = 'anti-vision' | 'vision' | 'one-year-goal' | 'one-month-project' | 'constraints'

export interface LifeOsComponent {
  id: string
  type: LifeOsComponentType
  title: string
  content: string
  isActive: boolean
  targetDate: string | null
  progress: number
  linkedGoalId: string | null
  createdAt: string
  updatedAt: string
}

// --- Goals (Fractal Drill-Down) ---

export type GoalGranularity = 'year' | 'month' | 'week' | 'day'

export interface LifeOsGoal {
  id: string
  parentId: string | null
  granularity: GoalGranularity
  title: string
  pageId: string | null
  startDate: string
  endDate: string
  status: 'active' | 'completed' | 'abandoned'
  progress: number
  order: number
  createdAt: string
  updatedAt: string
  childCount?: number
  completedChildCount?: number
}

export interface LifeOsGoalTask {
  id: string
  goalId: string
  title: string
  completed: boolean
  completedAt: string | null
  order: number
  createdAt: string
}

export interface GoalBreadcrumb {
  id: string
  title: string
  granularity: GoalGranularity
}

export interface IdentityStatement {
  id: string
  statement: string
  createdAt: string
  updatedAt: string
}

export interface DailyLever {
  id: string
  projectId: string | null
  title: string
  date: string
  completed: boolean
  completedAt: string | null
  order: number
  createdAt: string
}

export interface AutopilotBreaker {
  id: string
  time: string
  question: string
  enabled: boolean
  createdAt: string
}

export interface LifeOsJournalEntry {
  id: string
  type: 'morning' | 'evening' | 'breaker' | 'walking' | 'freeform'
  date: string
  responses: JournalResponse[]
  pageId: string | null
  completedAt: string | null
  createdAt: string
}

export interface JournalResponse {
  questionKey: string
  question: string
  answer: string
}

export interface XpEvent {
  id: string
  type:
    | 'lever_completed'
    | 'all_levers'
    | 'morning_protocol'
    | 'evening_synthesis'
    | 'project_completed'
    | 'streak_bonus'
    | 'breaker_answered'
  xp: number
  description: string
  date: string
  createdAt: string
}

export interface LifeOsStats {
  totalXp: number
  level: number
  xpToNextLevel: number
  currentStreak: number
  bestStreak: number
  projectsCompleted: number
  todayLeversCompleted: number
  todayLeversTotal: number
  morningDone: boolean
  eveningDone: boolean
}

// --- Pages (Notion-like) ---

export type PlannerPageType = 'page' | 'tasks' | 'habits' | 'journal' | 'project' | 'folder' | 'finances'

export interface PlannerPage {
  id: string
  categoryId: string
  parentId: string | null
  title: string
  icon: string
  content: string // JSON stringified BlockNote blocks
  pageType: PlannerPageType
  pinned: boolean
  isSystem: boolean // system pages can't be deleted
  order: number
  createdAt: string
  updatedAt: string
}
