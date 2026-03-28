import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { logger } from '../lib/logger.js'
import { initDatabaseTables } from './databases.js'
import { initDocumentTables } from './documents.js'
import { initGoalTables } from './goals.js'
import { seedExampleContent, seedLifeOsDefaults } from './seed.js'

const DB_PATH = resolve(import.meta.dirname, '../../data/planner.db')

let db: Database.Database | null = null

export function getPlannerDb(): Database.Database {
  if (!db) {
    mkdirSync(dirname(DB_PATH), { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function initPlannerDb(): void {
  const db = getPlannerDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS planner_categories (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#f59e0b',
      "order" INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS planner_notes (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES planner_categories(id),
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS planner_goals (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES planner_categories(id),
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      target_date TEXT,
      status TEXT DEFAULT 'active',
      progress INTEGER DEFAULT 0,
      ai_plan TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS planner_reminders (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      due_at TEXT NOT NULL,
      repeat TEXT,
      completed INTEGER DEFAULT 0,
      linked_goal_id TEXT REFERENCES planner_goals(id) ON DELETE SET NULL,
      linked_todo_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS planner_transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'EUR',
      description TEXT NOT NULL,
      category TEXT DEFAULT '',
      date TEXT NOT NULL,
      recurring INTEGER DEFAULT 0,
      recurring_interval TEXT,
      account_id TEXT REFERENCES planner_accounts(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS planner_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'bank',
      balance REAL DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      icon TEXT DEFAULT 'Wallet',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS planner_pages (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES planner_categories(id),
      parent_id TEXT REFERENCES planner_pages(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      icon TEXT DEFAULT '📄',
      content TEXT DEFAULT '[]',
      page_type TEXT DEFAULT 'page',
      pinned INTEGER DEFAULT 0,
      is_system INTEGER DEFAULT 0,
      "order" INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS life_os_components (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      target_date TEXT,
      progress INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS life_os_identity (
      id TEXT PRIMARY KEY,
      statement TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS life_os_daily_levers (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      "order" INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS life_os_autopilot_breakers (
      id TEXT PRIMARY KEY,
      time TEXT NOT NULL,
      question TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS life_os_journal (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      responses TEXT DEFAULT '[]',
      page_id TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS life_os_xp (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      xp INTEGER NOT NULL,
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS life_os_psy_tracker (
      date TEXT PRIMARY KEY,
      score INTEGER NOT NULL CHECK(score >= 1 AND score <= 10),
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_levers_date ON life_os_daily_levers(date);
    CREATE INDEX IF NOT EXISTS idx_journal_date ON life_os_journal(date);
    CREATE INDEX IF NOT EXISTS idx_xp_date ON life_os_xp(date);
  `)

  // Seed default categories
  const existing = db.prepare('SELECT COUNT(*) as count FROM planner_categories').get() as { count: number }
  if (existing.count === 0) {
    const insert = db.prepare(
      'INSERT INTO planner_categories (id, slug, label, icon, color, "order") VALUES (?, ?, ?, ?, ?, ?)',
    )

    const categories = [
      { slug: 'planning', label: 'Planning', icon: 'CalendarDays', color: '#f59e0b', order: 0 },
      { slug: 'finances', label: 'Finances', icon: 'Wallet', color: '#10b981', order: 1 },
      { slug: 'nutrition', label: 'Nutrition', icon: 'Apple', color: '#ef4444', order: 2 },
      { slug: 'sport', label: 'Sport', icon: 'Dumbbell', color: '#3b82f6', order: 3 },
      { slug: 'traveling', label: 'Traveling', icon: 'Plane', color: '#8b5cf6', order: 4 },
      { slug: 'resources', label: 'Resources', icon: 'BookOpen', color: '#06b6d4', order: 5 },
      { slug: 'archive', label: 'Archive', icon: 'Archive', color: '#6b7280', order: 6 },
    ]

    const txn = db.transaction(() => {
      for (const cat of categories) {
        const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
        insert.run(id, cat.slug, cat.label, cat.icon, cat.color, cat.order)
      }
    })
    txn()
    logger.info('Planner: seeded default categories')
  }

  // Init database tables
  initDatabaseTables()

  // Init BlockSuite document tables
  initDocumentTables()

  // Note: BlockNote→BlockSuite migration requires client-side Yjs libraries.
  // Existing page content remains in planner_pages.content as JSON fallback.
  // New pages use BlockSuite docs created client-side.

  // Seed system pages (once)
  seedSystemPages(db)

  // Migrate old notes to pages
  migrateNotesToPages(db)

  // Seed example content (once)
  seedExampleContent()

  // Init goal tables
  initGoalTables()

  // Seed Life OS defaults (once)
  seedLifeOsDefaults()

  logger.info('Planner DB initialized')
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

// --- Categories ---
export function getCategories() {
  return getPlannerDb().prepare('SELECT * FROM planner_categories ORDER BY "order" ASC').all()
}

export function createCategory(slug: string, label: string, icon: string, color: string) {
  const db = getPlannerDb()
  const id = genId()
  const maxOrder = (db.prepare('SELECT COALESCE(MAX("order"), -1) as m FROM planner_categories').get() as { m: number })
    .m
  db.prepare('INSERT INTO planner_categories (id, slug, label, icon, color, "order") VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    slug,
    label,
    icon,
    color,
    maxOrder + 1,
  )
  return db.prepare('SELECT * FROM planner_categories WHERE id = ?').get(id)
}

export function deleteCategory(id: string) {
  const db = getPlannerDb()
  // Delete all pages in this category first (foreign key cascade may not work without pragma)
  db.prepare('DELETE FROM planner_pages WHERE category_id = ?').run(id)
  db.prepare('DELETE FROM planner_categories WHERE id = ?').run(id)
}

// --- Notes ---
export function getNotes(categoryId?: string) {
  const db = getPlannerDb()
  if (categoryId) {
    return db
      .prepare('SELECT * FROM planner_notes WHERE category_id = ? ORDER BY pinned DESC, updated_at DESC')
      .all(categoryId)
  }
  return db.prepare('SELECT * FROM planner_notes ORDER BY pinned DESC, updated_at DESC').all()
}

export function createNote(categoryId: string, title: string, content = '') {
  const db = getPlannerDb()
  const id = genId()
  db.prepare('INSERT INTO planner_notes (id, category_id, title, content) VALUES (?, ?, ?, ?)').run(
    id,
    categoryId,
    title,
    content,
  )
  return db.prepare('SELECT * FROM planner_notes WHERE id = ?').get(id)
}

export function updateNote(id: string, updates: Record<string, unknown>) {
  const db = getPlannerDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (updates.title !== undefined) {
    sets.push('title = ?')
    values.push(updates.title)
  }
  if (updates.content !== undefined) {
    sets.push('content = ?')
    values.push(updates.content)
  }
  if (updates.pinned !== undefined) {
    sets.push('pinned = ?')
    values.push(updates.pinned ? 1 : 0)
  }
  if (sets.length === 0) return null
  sets.push("updated_at = datetime('now')")
  values.push(id)
  db.prepare(`UPDATE planner_notes SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM planner_notes WHERE id = ?').get(id)
}

export function deleteNote(id: string) {
  getPlannerDb().prepare('DELETE FROM planner_notes WHERE id = ?').run(id)
}

// --- Goals ---
export function getGoals(categoryId?: string) {
  const db = getPlannerDb()
  if (categoryId) {
    return db.prepare('SELECT * FROM planner_goals WHERE category_id = ? ORDER BY created_at DESC').all(categoryId)
  }
  return db.prepare('SELECT * FROM planner_goals ORDER BY created_at DESC').all()
}

export function createGoal(categoryId: string, title: string, description = '', targetDate: string | null = null) {
  const db = getPlannerDb()
  const id = genId()
  db.prepare('INSERT INTO planner_goals (id, category_id, title, description, target_date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    categoryId,
    title,
    description,
    targetDate,
  )
  return db.prepare('SELECT * FROM planner_goals WHERE id = ?').get(id)
}

export function updateGoal(id: string, updates: Record<string, unknown>) {
  const db = getPlannerDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (updates.title !== undefined) {
    sets.push('title = ?')
    values.push(updates.title)
  }
  if (updates.description !== undefined) {
    sets.push('description = ?')
    values.push(updates.description)
  }
  if (updates.targetDate !== undefined) {
    sets.push('target_date = ?')
    values.push(updates.targetDate)
  }
  if (updates.status !== undefined) {
    sets.push('status = ?')
    values.push(updates.status)
  }
  if (updates.progress !== undefined) {
    sets.push('progress = ?')
    values.push(updates.progress)
  }
  if (updates.aiPlan !== undefined) {
    sets.push('ai_plan = ?')
    values.push(JSON.stringify(updates.aiPlan))
  }
  if (sets.length === 0) return null
  sets.push("updated_at = datetime('now')")
  values.push(id)
  db.prepare(`UPDATE planner_goals SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM planner_goals WHERE id = ?').get(id)
}

export function deleteGoal(id: string) {
  getPlannerDb().prepare('DELETE FROM planner_goals WHERE id = ?').run(id)
}

// --- Reminders ---
export function getReminders(upcoming = false) {
  const db = getPlannerDb()
  if (upcoming) {
    return db
      .prepare("SELECT * FROM planner_reminders WHERE completed = 0 AND due_at >= datetime('now') ORDER BY due_at ASC")
      .all()
  }
  return db.prepare('SELECT * FROM planner_reminders ORDER BY due_at DESC').all()
}

export function createReminder(
  title: string,
  dueAt: string,
  opts: { description?: string; repeat?: string; linkedGoalId?: string; linkedTodoId?: string } = {},
) {
  const db = getPlannerDb()
  const id = genId()
  db.prepare(
    'INSERT INTO planner_reminders (id, title, description, due_at, repeat, linked_goal_id, linked_todo_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    title,
    opts.description || '',
    dueAt,
    opts.repeat || null,
    opts.linkedGoalId || null,
    opts.linkedTodoId || null,
  )
  return db.prepare('SELECT * FROM planner_reminders WHERE id = ?').get(id)
}

export function updateReminder(id: string, updates: Record<string, unknown>) {
  const db = getPlannerDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (updates.title !== undefined) {
    sets.push('title = ?')
    values.push(updates.title)
  }
  if (updates.description !== undefined) {
    sets.push('description = ?')
    values.push(updates.description)
  }
  if (updates.dueAt !== undefined) {
    sets.push('due_at = ?')
    values.push(updates.dueAt)
  }
  if (updates.repeat !== undefined) {
    sets.push('repeat = ?')
    values.push(updates.repeat)
  }
  if (updates.completed !== undefined) {
    sets.push('completed = ?')
    values.push(updates.completed ? 1 : 0)
  }
  if (sets.length === 0) return null
  values.push(id)
  db.prepare(`UPDATE planner_reminders SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM planner_reminders WHERE id = ?').get(id)
}

export function deleteReminder(id: string) {
  getPlannerDb().prepare('DELETE FROM planner_reminders WHERE id = ?').run(id)
}

// --- Transactions ---
export function getTransactions(filters?: { from?: string; to?: string; type?: string }) {
  const db = getPlannerDb()
  const where: string[] = []
  const values: unknown[] = []
  if (filters?.from) {
    where.push('date >= ?')
    values.push(filters.from)
  }
  if (filters?.to) {
    where.push('date <= ?')
    values.push(filters.to)
  }
  if (filters?.type) {
    where.push('type = ?')
    values.push(filters.type)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  return db.prepare(`SELECT * FROM planner_transactions ${clause} ORDER BY date DESC, created_at DESC`).all(...values)
}

export function createTransaction(data: {
  type: string
  amount: number
  currency?: string
  description: string
  category?: string
  date: string
  recurring?: boolean
  recurringInterval?: string
  accountId?: string
}) {
  const db = getPlannerDb()
  const id = genId()
  db.prepare(
    'INSERT INTO planner_transactions (id, type, amount, currency, description, category, date, recurring, recurring_interval, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    data.type,
    data.amount,
    data.currency || 'EUR',
    data.description,
    data.category || '',
    data.date,
    data.recurring ? 1 : 0,
    data.recurringInterval || null,
    data.accountId || null,
  )
  return db.prepare('SELECT * FROM planner_transactions WHERE id = ?').get(id)
}

export function updateTransaction(id: string, updates: Record<string, unknown>) {
  const db = getPlannerDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (updates.type !== undefined) {
    sets.push('type = ?')
    values.push(updates.type)
  }
  if (updates.amount !== undefined) {
    sets.push('amount = ?')
    values.push(updates.amount)
  }
  if (updates.currency !== undefined) {
    sets.push('currency = ?')
    values.push(updates.currency)
  }
  if (updates.description !== undefined) {
    sets.push('description = ?')
    values.push(updates.description)
  }
  if (updates.category !== undefined) {
    sets.push('category = ?')
    values.push(updates.category)
  }
  if (updates.date !== undefined) {
    sets.push('date = ?')
    values.push(updates.date)
  }
  if (sets.length === 0) return null
  values.push(id)
  db.prepare(`UPDATE planner_transactions SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM planner_transactions WHERE id = ?').get(id)
}

export function deleteTransaction(id: string) {
  getPlannerDb().prepare('DELETE FROM planner_transactions WHERE id = ?').run(id)
}

// --- Accounts ---
export function getAccounts() {
  return getPlannerDb().prepare('SELECT * FROM planner_accounts ORDER BY created_at DESC').all()
}

export function createAccount(data: {
  name: string
  type?: string
  balance?: number
  currency?: string
  icon?: string
}) {
  const db = getPlannerDb()
  const id = genId()
  db.prepare('INSERT INTO planner_accounts (id, name, type, balance, currency, icon) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    data.name,
    data.type || 'bank',
    data.balance || 0,
    data.currency || 'EUR',
    data.icon || 'Wallet',
  )
  return db.prepare('SELECT * FROM planner_accounts WHERE id = ?').get(id)
}

export function updateAccount(id: string, updates: Record<string, unknown>) {
  const db = getPlannerDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (updates.name !== undefined) {
    sets.push('name = ?')
    values.push(updates.name)
  }
  if (updates.type !== undefined) {
    sets.push('type = ?')
    values.push(updates.type)
  }
  if (updates.balance !== undefined) {
    sets.push('balance = ?')
    values.push(updates.balance)
  }
  if (updates.currency !== undefined) {
    sets.push('currency = ?')
    values.push(updates.currency)
  }
  if (updates.icon !== undefined) {
    sets.push('icon = ?')
    values.push(updates.icon)
  }
  if (sets.length === 0) return null
  values.push(id)
  db.prepare(`UPDATE planner_accounts SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM planner_accounts WHERE id = ?').get(id)
}

export function deleteAccount(id: string) {
  getPlannerDb().prepare('DELETE FROM planner_accounts WHERE id = ?').run(id)
}

// --- Pages ---
function seedSystemPages(db: Database.Database) {
  const existingSystem = db.prepare('SELECT COUNT(*) as count FROM planner_pages WHERE is_system = 1').get() as {
    count: number
  }
  if (existingSystem.count > 0) return

  const planningCat = db.prepare("SELECT id FROM planner_categories WHERE slug = 'planning'").get() as
    | { id: string }
    | undefined
  const financesCat = db.prepare("SELECT id FROM planner_categories WHERE slug = 'finances'").get() as
    | { id: string }
    | undefined
  if (!planningCat) return

  const insertPage = db.prepare(
    'INSERT INTO planner_pages (id, category_id, parent_id, title, icon, content, page_type, pinned, is_system, "order") VALUES (?, ?, NULL, ?, ?, \'[]\', ?, 1, 1, ?)',
  )

  const txn = db.transaction(() => {
    insertPage.run(genId(), planningCat.id, 'Tasks', '✅', 'tasks', 0)
    insertPage.run(genId(), planningCat.id, 'Habits', '🔥', 'habits', 1)
    insertPage.run(genId(), planningCat.id, 'Journal', '📔', 'journal', 2)
    if (financesCat) {
      insertPage.run(genId(), financesCat.id, 'Finances', '💰', 'finances', 0)
    }
  })
  txn()
  logger.info('Planner: seeded system pages')
}

function migrateNotesToPages(db: Database.Database) {
  // Check if there are notes to migrate that haven't been migrated yet
  const noteCount = (db.prepare('SELECT COUNT(*) as count FROM planner_notes').get() as { count: number }).count
  if (noteCount === 0) return

  // Check if migration has already happened by looking for migrated pages
  const migratedCount = (
    db.prepare("SELECT COUNT(*) as count FROM planner_pages WHERE page_type = 'page' AND is_system = 0").get() as {
      count: number
    }
  ).count
  if (migratedCount > 0) return

  const notes = db.prepare('SELECT * FROM planner_notes ORDER BY pinned DESC, updated_at DESC').all() as any[]
  const insertPage = db.prepare(
    'INSERT INTO planner_pages (id, category_id, parent_id, title, icon, content, page_type, pinned, is_system, "order", created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, \'page\', ?, 0, ?, ?, ?)',
  )

  const txn = db.transaction(() => {
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]
      // Convert markdown content to simple BlockNote JSON
      const blocks = markdownToBlocks(note.content || '')
      insertPage.run(
        genId(),
        note.category_id,
        note.title,
        '📄',
        JSON.stringify(blocks),
        note.pinned ? 1 : 0,
        i + 10,
        note.created_at,
        note.updated_at,
      )
    }
  })
  txn()
  logger.info(`Planner: migrated ${notes.length} notes to pages`)
}

function markdownToBlocks(md: string): any[] {
  if (!md.trim()) return [{ type: 'paragraph', content: [] }]

  const lines = md.split('\n')
  const blocks: any[] = []

  for (const line of lines) {
    const trimmed = line.trimEnd()

    // Heading
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        props: { level: headingMatch[1].length },
        content: [{ type: 'text', text: headingMatch[2], styles: {} }],
      })
      continue
    }

    // Checkbox
    const checkMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.*)/)
    if (checkMatch) {
      blocks.push({
        type: 'checkListItem',
        props: { checked: checkMatch[1] !== ' ' },
        content: [{ type: 'text', text: checkMatch[2], styles: {} }],
      })
      continue
    }

    // Bullet list
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/)
    if (bulletMatch) {
      blocks.push({
        type: 'bulletListItem',
        content: [{ type: 'text', text: bulletMatch[1], styles: {} }],
      })
      continue
    }

    // Numbered list
    const numMatch = trimmed.match(/^\d+\.\s+(.+)/)
    if (numMatch) {
      blocks.push({
        type: 'numberedListItem',
        content: [{ type: 'text', text: numMatch[1], styles: {} }],
      })
      continue
    }

    // Empty line
    if (!trimmed) {
      blocks.push({ type: 'paragraph', content: [] })
      continue
    }

    // Regular paragraph with inline styles
    blocks.push({
      type: 'paragraph',
      content: parseInlineStyles(trimmed),
    })
  }

  return blocks.length ? blocks : [{ type: 'paragraph', content: [] }]
}

function parseInlineStyles(text: string): any[] {
  const result: any[] = []
  // Simple bold/italic parsing
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g
  let match: RegExpExecArray | null = null
  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      result.push({ type: 'text', text: match[2], styles: { bold: true } })
    } else if (match[3]) {
      result.push({ type: 'text', text: match[3], styles: { italic: true } })
    } else if (match[4]) {
      result.push({ type: 'text', text: match[4], styles: { code: true } })
    } else if (match[5]) {
      result.push({ type: 'text', text: match[5], styles: {} })
    }
  }
  return result.length ? result : [{ type: 'text', text, styles: {} }]
}

export function getPages(categoryId?: string, parentId?: string | null) {
  const db = getPlannerDb()
  if (categoryId && parentId !== undefined) {
    if (parentId === null) {
      return db
        .prepare(
          'SELECT * FROM planner_pages WHERE category_id = ? AND parent_id IS NULL ORDER BY pinned DESC, "order" ASC, updated_at DESC',
        )
        .all(categoryId)
    }
    return db
      .prepare(
        'SELECT * FROM planner_pages WHERE category_id = ? AND parent_id = ? ORDER BY pinned DESC, "order" ASC, updated_at DESC',
      )
      .all(categoryId, parentId)
  }
  if (categoryId) {
    return db
      .prepare('SELECT * FROM planner_pages WHERE category_id = ? ORDER BY pinned DESC, "order" ASC, updated_at DESC')
      .all(categoryId)
  }
  return db.prepare('SELECT * FROM planner_pages ORDER BY pinned DESC, "order" ASC, updated_at DESC').all()
}

export function getPage(id: string) {
  return getPlannerDb().prepare('SELECT * FROM planner_pages WHERE id = ?').get(id)
}

export function createPage(
  categoryId: string,
  title: string,
  opts: {
    parentId?: string
    icon?: string
    content?: string
    pageType?: string
    pinned?: boolean
    order?: number
  } = {},
) {
  const db = getPlannerDb()
  const id = genId()
  // Determine order: next available under parent
  const maxOrder = db
    .prepare(
      opts.parentId
        ? 'SELECT COALESCE(MAX("order"), -1) as m FROM planner_pages WHERE category_id = ? AND parent_id = ?'
        : 'SELECT COALESCE(MAX("order"), -1) as m FROM planner_pages WHERE category_id = ? AND parent_id IS NULL',
    )
    .get(...(opts.parentId ? [categoryId, opts.parentId] : [categoryId])) as { m: number }

  const order = opts.order ?? maxOrder.m + 1
  db.prepare(
    'INSERT INTO planner_pages (id, category_id, parent_id, title, icon, content, page_type, pinned, is_system, "order") VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
  ).run(
    id,
    categoryId,
    opts.parentId || null,
    title,
    opts.icon || '📄',
    opts.content || '[]',
    opts.pageType || 'page',
    opts.pinned ? 1 : 0,
    order,
  )
  return db.prepare('SELECT * FROM planner_pages WHERE id = ?').get(id)
}

export function updatePage(id: string, updates: Record<string, unknown>) {
  const db = getPlannerDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (updates.title !== undefined) {
    sets.push('title = ?')
    values.push(updates.title)
  }
  if (updates.content !== undefined) {
    sets.push('content = ?')
    values.push(updates.content)
  }
  if (updates.icon !== undefined) {
    sets.push('icon = ?')
    values.push(updates.icon)
  }
  if (updates.pinned !== undefined) {
    sets.push('pinned = ?')
    values.push(updates.pinned ? 1 : 0)
  }
  if (updates.parentId !== undefined) {
    sets.push('parent_id = ?')
    values.push(updates.parentId)
  }
  if (updates.order !== undefined) {
    sets.push('"order" = ?')
    values.push(updates.order)
  }
  if (sets.length === 0) return null
  sets.push("updated_at = datetime('now')")
  values.push(id)
  db.prepare(`UPDATE planner_pages SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM planner_pages WHERE id = ?').get(id)
}

export function deletePage(id: string) {
  const db = getPlannerDb()
  // Don't allow deleting system pages
  const page = db.prepare('SELECT is_system FROM planner_pages WHERE id = ?').get(id) as
    | { is_system: number }
    | undefined
  if (page?.is_system) return false
  db.prepare('DELETE FROM planner_pages WHERE id = ?').run(id)
  return true
}

export function reorderPages(items: { id: string; order: number }[]) {
  const db = getPlannerDb()
  const stmt = db.prepare('UPDATE planner_pages SET "order" = ? WHERE id = ?')
  const txn = db.transaction(() => {
    for (const item of items) {
      stmt.run(item.order, item.id)
    }
  })
  txn()
}

// --- Dashboard Stats ---
export function getDashboardStats() {
  const db = getPlannerDb()
  const totalNotes = (db.prepare('SELECT COUNT(*) as count FROM planner_notes').get() as { count: number }).count
  const activeGoals = (
    db.prepare("SELECT COUNT(*) as count FROM planner_goals WHERE status = 'active'").get() as { count: number }
  ).count
  const upcomingReminders = (
    db
      .prepare("SELECT COUNT(*) as count FROM planner_reminders WHERE completed = 0 AND due_at >= datetime('now')")
      .get() as { count: number }
  ).count
  return { totalNotes, activeGoals, upcomingReminders }
}

// ============================================================
// Life OS — Components
// ============================================================

export function getLifeOsComponents() {
  return getPlannerDb().prepare('SELECT * FROM life_os_components ORDER BY created_at ASC').all()
}

export function getLifeOsComponentByType(type: string) {
  return getPlannerDb()
    .prepare('SELECT * FROM life_os_components WHERE type = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1')
    .get(type)
}

export function createLifeOsComponent(
  type: string,
  title: string,
  content = '',
  opts: { targetDate?: string; isActive?: boolean } = {},
) {
  const db = getPlannerDb()
  const id = genId()
  db.prepare(
    'INSERT INTO life_os_components (id, type, title, content, is_active, target_date) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, type, title, content, opts.isActive !== false ? 1 : 0, opts.targetDate || null)
  return db.prepare('SELECT * FROM life_os_components WHERE id = ?').get(id)
}

export function updateLifeOsComponent(id: string, updates: Record<string, unknown>) {
  const db = getPlannerDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (updates.title !== undefined) {
    sets.push('title = ?')
    values.push(updates.title)
  }
  if (updates.content !== undefined) {
    sets.push('content = ?')
    values.push(updates.content)
  }
  if (updates.isActive !== undefined) {
    sets.push('is_active = ?')
    values.push(updates.isActive ? 1 : 0)
  }
  if (updates.targetDate !== undefined) {
    sets.push('target_date = ?')
    values.push(updates.targetDate)
  }
  if (updates.progress !== undefined) {
    sets.push('progress = ?')
    values.push(updates.progress)
  }
  if (updates.linkedGoalId !== undefined) {
    sets.push('linked_goal_id = ?')
    values.push(updates.linkedGoalId)
  }
  if (sets.length === 0) return null
  sets.push("updated_at = datetime('now')")
  values.push(id)
  db.prepare(`UPDATE life_os_components SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM life_os_components WHERE id = ?').get(id)
}

export function deleteLifeOsComponent(id: string) {
  getPlannerDb().prepare('DELETE FROM life_os_components WHERE id = ?').run(id)
}

// ============================================================
// Life OS — Identity
// ============================================================

export function getIdentity() {
  return getPlannerDb().prepare('SELECT * FROM life_os_identity ORDER BY created_at DESC LIMIT 1').get()
}

export function upsertIdentity(statement: string) {
  const db = getPlannerDb()
  const existing = db.prepare('SELECT id FROM life_os_identity ORDER BY created_at DESC LIMIT 1').get() as
    | { id: string }
    | undefined
  if (existing) {
    db.prepare("UPDATE life_os_identity SET statement = ?, updated_at = datetime('now') WHERE id = ?").run(
      statement,
      existing.id,
    )
    return db.prepare('SELECT * FROM life_os_identity WHERE id = ?').get(existing.id)
  }
  const id = genId()
  db.prepare('INSERT INTO life_os_identity (id, statement) VALUES (?, ?)').run(id, statement)
  return db.prepare('SELECT * FROM life_os_identity WHERE id = ?').get(id)
}

// ============================================================
// Life OS — Daily Levers
// ============================================================

export function getDailyLevers(date: string) {
  return getPlannerDb().prepare('SELECT * FROM life_os_daily_levers WHERE date = ? ORDER BY "order" ASC').all(date)
}

export function createDailyLever(title: string, date: string, opts: { projectId?: string; order?: number } = {}) {
  const db = getPlannerDb()
  const id = genId()
  const maxOrder = (
    db.prepare('SELECT COALESCE(MAX("order"), -1) as m FROM life_os_daily_levers WHERE date = ?').get(date) as {
      m: number
    }
  ).m
  db.prepare('INSERT INTO life_os_daily_levers (id, project_id, title, date, "order") VALUES (?, ?, ?, ?, ?)').run(
    id,
    opts.projectId || null,
    title,
    date,
    opts.order ?? maxOrder + 1,
  )
  return db.prepare('SELECT * FROM life_os_daily_levers WHERE id = ?').get(id)
}

export function toggleDailyLever(id: string) {
  const db = getPlannerDb()
  const lever = db.prepare('SELECT completed FROM life_os_daily_levers WHERE id = ?').get(id) as
    | { completed: number }
    | undefined
  if (!lever) return null
  const newCompleted = lever.completed ? 0 : 1
  const completedAt = newCompleted ? new Date().toISOString() : null
  db.prepare('UPDATE life_os_daily_levers SET completed = ?, completed_at = ? WHERE id = ?').run(
    newCompleted,
    completedAt,
    id,
  )
  return db.prepare('SELECT * FROM life_os_daily_levers WHERE id = ?').get(id)
}

export function updateDailyLever(id: string, updates: Record<string, unknown>) {
  const db = getPlannerDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (updates.title !== undefined) {
    sets.push('title = ?')
    values.push(updates.title)
  }
  if (updates.order !== undefined) {
    sets.push('"order" = ?')
    values.push(updates.order)
  }
  if (sets.length === 0) return null
  values.push(id)
  db.prepare(`UPDATE life_os_daily_levers SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM life_os_daily_levers WHERE id = ?').get(id)
}

export function deleteDailyLever(id: string) {
  getPlannerDb().prepare('DELETE FROM life_os_daily_levers WHERE id = ?').run(id)
}

// ============================================================
// Life OS — Autopilot Breakers
// ============================================================

export function getAutopilotBreakers() {
  return getPlannerDb().prepare('SELECT * FROM life_os_autopilot_breakers ORDER BY time ASC').all()
}

export function createAutopilotBreaker(time: string, question: string) {
  const db = getPlannerDb()
  const id = genId()
  db.prepare('INSERT INTO life_os_autopilot_breakers (id, time, question) VALUES (?, ?, ?)').run(id, time, question)
  return db.prepare('SELECT * FROM life_os_autopilot_breakers WHERE id = ?').get(id)
}

export function updateAutopilotBreaker(id: string, updates: Record<string, unknown>) {
  const db = getPlannerDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (updates.time !== undefined) {
    sets.push('time = ?')
    values.push(updates.time)
  }
  if (updates.question !== undefined) {
    sets.push('question = ?')
    values.push(updates.question)
  }
  if (updates.enabled !== undefined) {
    sets.push('enabled = ?')
    values.push(updates.enabled ? 1 : 0)
  }
  if (sets.length === 0) return null
  values.push(id)
  db.prepare(`UPDATE life_os_autopilot_breakers SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM life_os_autopilot_breakers WHERE id = ?').get(id)
}

export function deleteAutopilotBreaker(id: string) {
  getPlannerDb().prepare('DELETE FROM life_os_autopilot_breakers WHERE id = ?').run(id)
}

// ============================================================
// Life OS — Journal
// ============================================================

export function getJournalEntry(date: string, type: string) {
  return getPlannerDb()
    .prepare('SELECT * FROM life_os_journal WHERE date = ? AND type = ? ORDER BY created_at DESC LIMIT 1')
    .get(date, type)
}

export function getJournalEntries(opts: { from?: string; to?: string; type?: string } = {}) {
  const db = getPlannerDb()
  const where: string[] = []
  const values: unknown[] = []
  if (opts.from) {
    where.push('date >= ?')
    values.push(opts.from)
  }
  if (opts.to) {
    where.push('date <= ?')
    values.push(opts.to)
  }
  if (opts.type) {
    where.push('type = ?')
    values.push(opts.type)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  return db.prepare(`SELECT * FROM life_os_journal ${clause} ORDER BY date DESC, created_at DESC`).all(...values)
}

export function upsertJournalEntry(
  date: string,
  type: string,
  responses: unknown[],
  opts: { pageId?: string; completedAt?: string } = {},
) {
  const db = getPlannerDb()
  const existing = db.prepare('SELECT id FROM life_os_journal WHERE date = ? AND type = ?').get(date, type) as
    | { id: string }
    | undefined
  if (existing) {
    db.prepare('UPDATE life_os_journal SET responses = ?, page_id = ?, completed_at = ? WHERE id = ?').run(
      JSON.stringify(responses),
      opts.pageId || null,
      opts.completedAt || null,
      existing.id,
    )
    return db.prepare('SELECT * FROM life_os_journal WHERE id = ?').get(existing.id)
  }
  const id = genId()
  db.prepare(
    'INSERT INTO life_os_journal (id, type, date, responses, page_id, completed_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, type, date, JSON.stringify(responses), opts.pageId || null, opts.completedAt || null)
  return db.prepare('SELECT * FROM life_os_journal WHERE id = ?').get(id)
}

export function deleteJournalEntry(id: string) {
  getPlannerDb().prepare('DELETE FROM life_os_journal WHERE id = ?').run(id)
}

// ============================================================
// Life OS — XP
// ============================================================

export function awardXp(type: string, xp: number, description: string, date: string) {
  const db = getPlannerDb()
  const id = genId()
  db.prepare('INSERT INTO life_os_xp (id, type, xp, description, date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    type,
    xp,
    description,
    date,
  )
  return db.prepare('SELECT * FROM life_os_xp WHERE id = ?').get(id)
}

export function getXpEvents(opts: { from?: string; to?: string } = {}) {
  const db = getPlannerDb()
  const where: string[] = []
  const values: unknown[] = []
  if (opts.from) {
    where.push('date >= ?')
    values.push(opts.from)
  }
  if (opts.to) {
    where.push('date <= ?')
    values.push(opts.to)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  return db.prepare(`SELECT * FROM life_os_xp ${clause} ORDER BY created_at DESC`).all(...values)
}

export function getLifeOsStats(): Record<string, unknown> {
  const db = getPlannerDb()
  const today = new Date().toISOString().slice(0, 10)

  // Total XP
  const totalXp = (db.prepare('SELECT COALESCE(SUM(xp), 0) as total FROM life_os_xp').get() as { total: number }).total
  const level = Math.floor(totalXp / 1000) + 1
  const xpToNextLevel = 1000 - (totalXp % 1000)

  // Projects completed
  const projectsCompleted = (
    db
      .prepare("SELECT COUNT(*) as count FROM life_os_components WHERE type = 'one-month-project' AND is_active = 0")
      .get() as { count: number }
  ).count

  // Today's levers
  const todayLevers = db.prepare('SELECT * FROM life_os_daily_levers WHERE date = ?').all(today) as {
    completed: number
  }[]
  const todayLeversTotal = todayLevers.length
  const todayLeversCompleted = todayLevers.filter((l) => l.completed).length

  // Morning/evening done today
  const morningDone = !!db
    .prepare("SELECT id FROM life_os_journal WHERE date = ? AND type = 'morning' AND completed_at IS NOT NULL")
    .get(today)
  const eveningDone = !!db
    .prepare("SELECT id FROM life_os_journal WHERE date = ? AND type = 'evening' AND completed_at IS NOT NULL")
    .get(today)

  // Streak calculation — walk backward from today
  let currentStreak = 0
  const checkDate = new Date()
  while (true) {
    const dateStr = checkDate.toISOString().slice(0, 10)
    const dayLevers = db.prepare('SELECT * FROM life_os_daily_levers WHERE date = ?').all(dateStr) as {
      completed: number
    }[]
    if (dayLevers.length === 0 || dayLevers.some((l) => !l.completed)) break
    currentStreak++
    checkDate.setDate(checkDate.getDate() - 1)
  }

  // Best streak (stored in meta or computed — for now just use current)
  const bestStreak = Math.max(currentStreak, 0)

  return {
    totalXp,
    level,
    xpToNextLevel,
    currentStreak,
    bestStreak,
    projectsCompleted,
    todayLeversCompleted,
    todayLeversTotal,
    morningDone,
    eveningDone,
  }
}

// ============================================================
// Life OS — Psychology Tracker
// ============================================================

export function upsertPsyScore(date: string, score: number, note?: string) {
  const db = getPlannerDb()
  db.prepare(
    'INSERT INTO life_os_psy_tracker (date, score, note) VALUES (?, ?, ?) ON CONFLICT(date) DO UPDATE SET score = excluded.score, note = excluded.note',
  ).run(date, score, note || null)
  return db.prepare('SELECT * FROM life_os_psy_tracker WHERE date = ?').get(date)
}

export function getPsyScores(days = 30) {
  const db = getPlannerDb()
  return db.prepare('SELECT date, score, note FROM life_os_psy_tracker ORDER BY date DESC LIMIT ?').all(days)
}

export function getPsyScoreToday() {
  const today = new Date().toISOString().slice(0, 10)
  return getPlannerDb().prepare('SELECT * FROM life_os_psy_tracker WHERE date = ?').get(today) as
    | { date: string; score: number; note: string | null }
    | undefined
}

// ============================================================
// Life OS — Journal Streak (for dashboard widget)
// ============================================================

export function getJournalStreak(): { streak: number; last30: boolean[] } {
  const db = getPlannerDb()
  const today = new Date()
  const last30: boolean[] = []

  // Check last 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const entry = db
      .prepare('SELECT id FROM life_os_journal WHERE date = ? AND completed_at IS NOT NULL LIMIT 1')
      .get(dateStr)
    last30.push(!!entry)
  }

  // Current streak (consecutive days from today going back)
  let streak = 0
  for (let i = last30.length - 1; i >= 0; i--) {
    if (last30[i]) streak++
    else break
  }

  return { streak, last30 }
}
