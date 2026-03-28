import { logger } from '../lib/logger.js'
import { createLifeOsComponent, getLifeOsComponentByType, getPlannerDb, updateLifeOsComponent } from './db.js'

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

// ============================================================
// Table init
// ============================================================

export function initGoalTables(): void {
  const db = getPlannerDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS life_os_goals (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES life_os_goals(id) ON DELETE CASCADE,
      granularity TEXT NOT NULL,
      title TEXT NOT NULL,
      page_id TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      progress INTEGER DEFAULT 0,
      "order" INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_goals_parent ON life_os_goals(parent_id);

    CREATE TABLE IF NOT EXISTS life_os_goal_tasks (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES life_os_goals(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      "order" INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_goal_tasks_goal ON life_os_goal_tasks(goal_id);
  `)

  // Add linked_goal_id to life_os_components if missing
  try {
    db.exec('ALTER TABLE life_os_components ADD COLUMN linked_goal_id TEXT')
  } catch {
    // Column already exists
  }

  logger.info('Goal tables initialized')
}

// ============================================================
// Goals CRUD
// ============================================================

function rowToGoal(row: any) {
  if (!row) return null
  return {
    id: row.id,
    parentId: row.parent_id,
    granularity: row.granularity,
    title: row.title,
    pageId: row.page_id,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    progress: row.progress,
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    childCount: row.child_count ?? undefined,
    completedChildCount: row.completed_child_count ?? undefined,
  }
}

export function getGoalRoots(status?: string) {
  const db = getPlannerDb()
  let sql = `
    SELECT g.*,
      (SELECT COUNT(*) FROM life_os_goals c WHERE c.parent_id = g.id) as child_count,
      (SELECT COUNT(*) FROM life_os_goals c WHERE c.parent_id = g.id AND c.status = 'completed') as completed_child_count
    FROM life_os_goals g
    WHERE g.parent_id IS NULL
  `
  const params: string[] = []
  if (status) {
    sql += ' AND g.status = ?'
    params.push(status)
  }
  sql += ' ORDER BY g."order" ASC, g.created_at ASC'
  return db
    .prepare(sql)
    .all(...params)
    .map(rowToGoal)
}

export function getGoal(id: string) {
  const db = getPlannerDb()
  const row = db
    .prepare(`
    SELECT g.*,
      (SELECT COUNT(*) FROM life_os_goals c WHERE c.parent_id = g.id) as child_count,
      (SELECT COUNT(*) FROM life_os_goals c WHERE c.parent_id = g.id AND c.status = 'completed') as completed_child_count
    FROM life_os_goals g WHERE g.id = ?
  `)
    .get(id)
  if (!row) return null

  // Build ancestor breadcrumb via recursive CTE
  const ancestors = db
    .prepare(`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id, title, granularity FROM life_os_goals WHERE id = (
        SELECT parent_id FROM life_os_goals WHERE id = ?
      )
      UNION ALL
      SELECT g.id, g.parent_id, g.title, g.granularity
      FROM life_os_goals g JOIN ancestors a ON g.id = a.parent_id
    )
    SELECT id, title, granularity FROM ancestors
  `)
    .all(id) as { id: string; title: string; granularity: string }[]

  return {
    goal: rowToGoal(row),
    ancestors: ancestors.reverse(), // root first
  }
}

export function getGoalChildren(parentId: string) {
  const db = getPlannerDb()
  return db
    .prepare(`
    SELECT g.*,
      (SELECT COUNT(*) FROM life_os_goals c WHERE c.parent_id = g.id) as child_count,
      (SELECT COUNT(*) FROM life_os_goals c WHERE c.parent_id = g.id AND c.status = 'completed') as completed_child_count
    FROM life_os_goals g
    WHERE g.parent_id = ?
    ORDER BY g."order" ASC, g.start_date ASC
  `)
    .all(parentId)
    .map(rowToGoal)
}

export function createGoal(
  granularity: string,
  title: string,
  startDate: string,
  endDate: string,
  opts: { parentId?: string; order?: number; skipSync?: boolean } = {},
) {
  const db = getPlannerDb()
  const id = genId()
  const pageId = genId()

  // Look up the 'planning' category ID for planner_pages FK
  const planningCat = db.prepare("SELECT id FROM planner_categories WHERE slug = 'planning'").get() as
    | { id: string }
    | undefined
  const categoryId = planningCat?.id || 'planning'

  // Create a planner_pages row for BlockSuite content
  db.prepare(
    'INSERT INTO planner_pages (id, category_id, title, icon, content, page_type, pinned, is_system, "order") VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)',
  ).run(pageId, categoryId, title, '🎯', '[]', 'page')

  // Determine order
  const maxOrder = db
    .prepare(
      opts.parentId
        ? 'SELECT COALESCE(MAX("order"), -1) as m FROM life_os_goals WHERE parent_id = ?'
        : 'SELECT COALESCE(MAX("order"), -1) as m FROM life_os_goals WHERE parent_id IS NULL',
    )
    .get(...(opts.parentId ? [opts.parentId] : [])) as { m: number }

  db.prepare(`
    INSERT INTO life_os_goals (id, parent_id, granularity, title, page_id, start_date, end_date, "order")
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, opts.parentId || null, granularity, title, pageId, startDate, endDate, opts.order ?? maxOrder.m + 1)

  // Sync: year goal ↔ Game Board one-year-goal component (skip if called from component sync)
  if (!opts.skipSync && granularity === 'year' && !opts.parentId) {
    syncGoalToComponent(id, title, endDate, 'one-year-goal')
  }

  return rowToGoal(db.prepare('SELECT * FROM life_os_goals WHERE id = ?').get(id))
}

export function updateGoal(id: string, updates: Record<string, unknown>) {
  const db = getPlannerDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (updates.title !== undefined) {
    sets.push('title = ?')
    values.push(updates.title)
  }
  if (updates.status !== undefined) {
    sets.push('status = ?')
    values.push(updates.status)
  }
  if (updates.progress !== undefined) {
    sets.push('progress = ?')
    values.push(updates.progress)
  }
  if (updates.startDate !== undefined) {
    sets.push('start_date = ?')
    values.push(updates.startDate)
  }
  if (updates.endDate !== undefined) {
    sets.push('end_date = ?')
    values.push(updates.endDate)
  }
  if (updates.order !== undefined) {
    sets.push('"order" = ?')
    values.push(updates.order)
  }
  if (sets.length === 0) return null
  sets.push("updated_at = datetime('now')")
  values.push(id)
  db.prepare(`UPDATE life_os_goals SET ${sets.join(', ')} WHERE id = ?`).run(...values)

  // Recalculate parent progress if status changed
  if (updates.status !== undefined) {
    const goal = db.prepare('SELECT parent_id FROM life_os_goals WHERE id = ?').get(id) as
      | { parent_id: string | null }
      | undefined
    if (goal?.parent_id) recalcProgress(goal.parent_id)
  }

  // Sync changes to linked Game Board component
  const updated = db.prepare('SELECT * FROM life_os_goals WHERE id = ?').get(id) as any
  if (updated) syncGoalToLinkedComponent(updated)

  return rowToGoal(updated)
}

export function deleteGoal(id: string) {
  const db = getPlannerDb()
  const goal = db.prepare('SELECT parent_id, page_id FROM life_os_goals WHERE id = ?').get(id) as
    | { parent_id: string | null; page_id: string | null }
    | undefined
  db.prepare('DELETE FROM life_os_goals WHERE id = ?').run(id)
  // Clean up orphaned page
  if (goal?.page_id) db.prepare('DELETE FROM planner_pages WHERE id = ?').run(goal.page_id)
  // Clean up linked Game Board component
  db.prepare('DELETE FROM life_os_components WHERE linked_goal_id = ?').run(id)
  // Recalc parent
  if (goal?.parent_id) recalcProgress(goal.parent_id)
}

// ============================================================
// Scaffold — auto-generate children
// ============================================================

export function scaffoldChildren(goalId: string) {
  const db = getPlannerDb()
  const goal = db.prepare('SELECT * FROM life_os_goals WHERE id = ?').get(goalId) as any
  if (!goal) return []

  // Don't scaffold if children exist
  const existing = db.prepare('SELECT COUNT(*) as c FROM life_os_goals WHERE parent_id = ?').get(goalId) as {
    c: number
  }
  if (existing.c > 0) return getGoalChildren(goalId)

  // Parse dates as plain YYYY-MM-DD integers to avoid timezone issues
  const [sY, sM, sD] = goal.start_date.split('-').map(Number)
  const [eY, eM, eD] = goal.end_date.split('-').map(Number)

  const txn = db.transaction(() => {
    const children: any[] = []

    if (goal.granularity === 'year') {
      // Generate 12 months
      for (let m = 1; m <= 12; m++) {
        const mStart = `${sY}-${pad(m)}-01`
        const lastDay = new Date(Date.UTC(sY, m, 0)).getUTCDate()
        const mEnd = `${sY}-${pad(m)}-${pad(lastDay)}`
        // Clamp to goal range
        if (mEnd < goal.start_date || mStart > goal.end_date) continue
        const clampedStart = mStart < goal.start_date ? goal.start_date : mStart
        const clampedEnd = mEnd > goal.end_date ? goal.end_date : mEnd
        const monthName = new Date(Date.UTC(sY, m - 1, 1)).toLocaleDateString('en-US', {
          month: 'long',
          timeZone: 'UTC',
        })
        children.push(createGoal('month', monthName, clampedStart, clampedEnd, { parentId: goalId, order: m }))
      }
    } else if (goal.granularity === 'month') {
      // Generate weeks (Mon-Sun aligned)
      const cursor = new Date(Date.UTC(sY, sM - 1, sD))
      const endDate = new Date(Date.UTC(eY, eM - 1, eD))

      let weekNum = 0
      while (cursor <= endDate) {
        const wStart = new Date(cursor)
        const wEnd = new Date(cursor)
        wEnd.setUTCDate(wEnd.getUTCDate() + 6)
        if (wEnd > endDate) wEnd.setTime(endDate.getTime())
        weekNum++
        children.push(
          createGoal('week', `Week ${weekNum}`, fmtUTC(wStart), fmtUTC(wEnd), { parentId: goalId, order: weekNum }),
        )
        cursor.setUTCDate(cursor.getUTCDate() + 7)
      }
    } else if (goal.granularity === 'week') {
      // Generate days
      const cursor = new Date(Date.UTC(sY, sM - 1, sD))
      const endDate = new Date(Date.UTC(eY, eM - 1, eD))
      let dayNum = 0
      while (cursor <= endDate) {
        const title = cursor.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        })
        children.push(createGoal('day', title, fmtUTC(cursor), fmtUTC(cursor), { parentId: goalId, order: dayNum++ }))
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
    }

    return children
  })

  return txn()
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
function fmtUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

// ============================================================
// Sync: Goals ↔ Game Board Components
// ============================================================

/** When creating a year goal, create or update the Game Board component and link them */
function syncGoalToComponent(goalId: string, title: string, endDate: string, componentType: string) {
  const db = getPlannerDb()
  const existing = getLifeOsComponentByType(componentType) as any
  if (existing) {
    // Link existing component to this goal
    updateLifeOsComponent(existing.id, { title, targetDate: endDate, linkedGoalId: goalId })
  } else {
    // Create new component linked to this goal
    const comp = createLifeOsComponent(componentType, title, '', { targetDate: endDate }) as any
    if (comp) {
      db.prepare('UPDATE life_os_components SET linked_goal_id = ? WHERE id = ?').run(goalId, comp.id)
    }
  }
}

/** When updating a goal, sync title/progress to linked Game Board component */
function syncGoalToLinkedComponent(goal: any) {
  const db = getPlannerDb()
  // Find component linked to this goal
  const comp = db.prepare('SELECT * FROM life_os_components WHERE linked_goal_id = ?').get(goal.id) as any
  if (comp) {
    updateLifeOsComponent(comp.id, {
      title: goal.title,
      progress: goal.progress,
      targetDate: goal.end_date,
    })
  }
}

/** When creating/updating a Game Board component, create/sync a goal in Projects */
export function syncComponentToGoal(
  componentId: string,
  type: string,
  title: string,
  _content: string,
  targetDate: string | null,
) {
  const db = getPlannerDb()
  const comp = db.prepare('SELECT * FROM life_os_components WHERE id = ?').get(componentId) as any
  if (!comp) return

  const granularity = type === 'one-year-goal' ? 'year' : type === 'one-month-project' ? 'month' : null
  if (!granularity) return

  if (comp.linked_goal_id) {
    // Update existing linked goal
    const goal = db.prepare('SELECT * FROM life_os_goals WHERE id = ?').get(comp.linked_goal_id) as any
    if (goal) {
      const sets: string[] = ['title = ?', "updated_at = datetime('now')"]
      const vals: any[] = [title]
      if (targetDate) {
        sets.push('end_date = ?')
        vals.push(targetDate)
      }
      vals.push(comp.linked_goal_id)
      db.prepare(`UPDATE life_os_goals SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
    }
  } else {
    // Create a new goal and link it
    const now = new Date()
    const startDate =
      granularity === 'year' ? `${now.getFullYear()}-01-01` : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
    const endDate =
      targetDate ||
      (granularity === 'year'
        ? `${now.getFullYear()}-12-31`
        : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).getUTCDate())}`)

    const goal = createGoal(granularity, title, startDate, endDate, { skipSync: true }) as any
    if (goal) {
      db.prepare('UPDATE life_os_components SET linked_goal_id = ? WHERE id = ?').run(goal.id, componentId)
    }
  }
}

// ============================================================
// Progress recalculation
// ============================================================

export function recalcProgress(goalId: string) {
  const db = getPlannerDb()
  const stats = db
    .prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM life_os_goals WHERE parent_id = ?
  `)
    .get(goalId) as { total: number; completed: number }

  const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  db.prepare("UPDATE life_os_goals SET progress = ?, updated_at = datetime('now') WHERE id = ?").run(progress, goalId)

  // Bubble up
  const parent = db.prepare('SELECT parent_id FROM life_os_goals WHERE id = ?').get(goalId) as
    | { parent_id: string | null }
    | undefined
  if (parent?.parent_id) recalcProgress(parent.parent_id)
}

// ============================================================
// Goal Tasks CRUD
// ============================================================

function rowToTask(row: any) {
  if (!row) return null
  return {
    id: row.id,
    goalId: row.goal_id,
    title: row.title,
    completed: !!row.completed,
    completedAt: row.completed_at,
    order: row.order,
    createdAt: row.created_at,
  }
}

export function getGoalTasks(goalId: string) {
  return getPlannerDb()
    .prepare('SELECT * FROM life_os_goal_tasks WHERE goal_id = ? ORDER BY "order" ASC')
    .all(goalId)
    .map(rowToTask)
}

export function createGoalTask(goalId: string, title: string) {
  const db = getPlannerDb()
  const id = genId()
  const maxOrder = (
    db.prepare('SELECT COALESCE(MAX("order"), -1) as m FROM life_os_goal_tasks WHERE goal_id = ?').get(goalId) as {
      m: number
    }
  ).m
  db.prepare('INSERT INTO life_os_goal_tasks (id, goal_id, title, "order") VALUES (?, ?, ?, ?)').run(
    id,
    goalId,
    title,
    maxOrder + 1,
  )
  return rowToTask(db.prepare('SELECT * FROM life_os_goal_tasks WHERE id = ?').get(id))
}

export function toggleGoalTask(taskId: string) {
  const db = getPlannerDb()
  const task = db.prepare('SELECT * FROM life_os_goal_tasks WHERE id = ?').get(taskId) as any
  if (!task) return null
  const newCompleted = task.completed ? 0 : 1
  const completedAt = newCompleted ? new Date().toISOString() : null
  db.prepare('UPDATE life_os_goal_tasks SET completed = ?, completed_at = ? WHERE id = ?').run(
    newCompleted,
    completedAt,
    taskId,
  )

  // Recalc day-level progress from tasks
  const goal = db.prepare('SELECT * FROM life_os_goals WHERE id = ?').get(task.goal_id) as any
  if (goal?.granularity === 'day') {
    const stats = db
      .prepare(
        'SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as done FROM life_os_goal_tasks WHERE goal_id = ?',
      )
      .get(task.goal_id) as { total: number; done: number }
    const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
    db.prepare("UPDATE life_os_goals SET progress = ?, updated_at = datetime('now') WHERE id = ?").run(
      progress,
      task.goal_id,
    )
    if (goal.parent_id) recalcProgress(goal.parent_id)
  }

  return rowToTask(db.prepare('SELECT * FROM life_os_goal_tasks WHERE id = ?').get(taskId))
}

export function deleteGoalTask(taskId: string) {
  const db = getPlannerDb()
  const task = db.prepare('SELECT goal_id FROM life_os_goal_tasks WHERE id = ?').get(taskId) as
    | { goal_id: string }
    | undefined
  db.prepare('DELETE FROM life_os_goal_tasks WHERE id = ?').run(taskId)
  // Recalc progress
  if (task) {
    const goal = db.prepare('SELECT parent_id, granularity FROM life_os_goals WHERE id = ?').get(task.goal_id) as any
    if (goal?.granularity === 'day') {
      const stats = db
        .prepare(
          'SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as done FROM life_os_goal_tasks WHERE goal_id = ?',
        )
        .get(task.goal_id) as { total: number; done: number }
      const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
      db.prepare("UPDATE life_os_goals SET progress = ?, updated_at = datetime('now') WHERE id = ?").run(
        progress,
        task.goal_id,
      )
      if (goal.parent_id) recalcProgress(goal.parent_id)
    }
  }
}
