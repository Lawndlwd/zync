import { logger } from '../lib/logger.js'
import { createDatabase, createDbItem, createDbView } from './databases.js'
import {
  createAccount,
  createAutopilotBreaker,
  createGoal,
  createLifeOsComponent,
  createPage,
  createReminder,
  createTransaction,
  getCategories,
  getPlannerDb,
  updateGoal,
  upsertIdentity,
} from './db.js'

export function seedExampleContent(): void {
  const db = getPlannerDb()

  // Create meta table for tracking seed status
  db.exec(`CREATE TABLE IF NOT EXISTS planner_meta (key TEXT PRIMARY KEY, value TEXT)`)

  // Check if already seeded
  const row = db.prepare("SELECT value FROM planner_meta WHERE key = 'seeded'").get() as { value: string } | undefined
  if (row) return

  const categories = getCategories() as { id: string; slug: string }[]
  const planningCat = categories.find((c) => c.slug === 'planning')
  const financesCat = categories.find((c) => c.slug === 'finances')
  if (!planningCat) {
    logger.warn('Planner seed: planning category not found, skipping')
    return
  }

  // --- Goals ---
  const now = new Date()

  const sixMonths = new Date(now)
  sixMonths.setMonth(sixMonths.getMonth() + 6)

  const fourMonths = new Date(now)
  fourMonths.setMonth(fourMonths.getMonth() + 4)

  const endOfYear = new Date(now.getFullYear(), 11, 31)

  const goal1 = createGoal(
    planningCat.id,
    'Learn Spanish',
    'Reach conversational fluency through daily practice',
    sixMonths.toISOString().slice(0, 10),
  ) as any
  updateGoal(goal1.id, { status: 'active', progress: 30 })

  const goal2 = createGoal(
    planningCat.id,
    'Run a marathon',
    'Train consistently and complete a full 42km marathon',
    fourMonths.toISOString().slice(0, 10),
  ) as any
  updateGoal(goal2.id, { status: 'active', progress: 15 })

  const goal3 = createGoal(
    planningCat.id,
    'Read 24 books this year',
    'Two books per month across fiction and non-fiction',
    endOfYear.toISOString().slice(0, 10),
  ) as any
  updateGoal(goal3.id, { status: 'active', progress: 50 })

  // --- Reminders ---
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)

  const inTwoDays = new Date(now)
  inTwoDays.setDate(inTwoDays.getDate() + 2)
  inTwoDays.setHours(18, 0, 0, 0)

  const inSevenDays = new Date(now)
  inSevenDays.setDate(inSevenDays.getDate() + 7)
  inSevenDays.setHours(9, 0, 0, 0)

  createReminder('Call dentist', tomorrow.toISOString())
  createReminder('Pay rent', inSevenDays.toISOString())
  createReminder('Weekly review', inTwoDays.toISOString())

  // --- Pages ---
  const weeklyReviewContent = JSON.stringify([
    { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Weekly Review', styles: {} }] },
    {
      type: 'checkListItem',
      props: { checked: false },
      content: [{ type: 'text', text: 'What went well?', styles: {} }],
    },
    {
      type: 'checkListItem',
      props: { checked: false },
      content: [{ type: 'text', text: 'What could improve?', styles: {} }],
    },
    {
      type: 'checkListItem',
      props: { checked: false },
      content: [{ type: 'text', text: 'Goals for next week', styles: {} }],
    },
  ])

  const projectIdeasContent = JSON.stringify([
    { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Project Ideas', styles: {} }] },
    {
      type: 'bulletListItem',
      content: [{ type: 'text', text: 'Build a personal finance tracker with AI insights', styles: {} }],
    },
    {
      type: 'bulletListItem',
      content: [{ type: 'text', text: 'Create a recipe app that generates meal plans', styles: {} }],
    },
    {
      type: 'bulletListItem',
      content: [{ type: 'text', text: 'Develop a habit tracker with streak visualizations', styles: {} }],
    },
  ])

  createPage(planningCat.id, 'Weekly Review Template', { icon: '📋', content: weeklyReviewContent })
  createPage(planningCat.id, 'Project Ideas', { icon: '💡', content: projectIdeasContent })

  // --- Databases ---
  const tasksSchema = JSON.stringify([
    { name: 'Title', type: 'text' },
    { name: 'Status', type: 'select', options: ['Todo', 'In Progress', 'Done'] },
    { name: 'Priority', type: 'select', options: ['P1', 'P2', 'P3', 'P4'] },
    { name: 'Due', type: 'date' },
  ])

  const tasksDb = createDatabase('Tasks', planningCat.id, { schema: tasksSchema }) as any

  const inFiveDays = new Date(now)
  inFiveDays.setDate(inFiveDays.getDate() + 5)
  const inTenDays = new Date(now)
  inTenDays.setDate(inTenDays.getDate() + 10)
  const inThreeDays = new Date(now)
  inThreeDays.setDate(inThreeDays.getDate() + 3)

  createDbItem(tasksDb.id, {
    Title: 'Prepare monthly docs',
    Status: 'Todo',
    Priority: 'P2',
    Due: inFiveDays.toISOString().slice(0, 10),
  })
  createDbItem(tasksDb.id, {
    Title: 'Review booking listings',
    Status: 'In Progress',
    Priority: 'P3',
    Due: inTenDays.toISOString().slice(0, 10),
  })
  createDbItem(tasksDb.id, {
    Title: 'Make Excel sheet',
    Status: 'Todo',
    Priority: 'P1',
    Due: inThreeDays.toISOString().slice(0, 10),
  })
  createDbItem(tasksDb.id, { Title: 'Update CV', Status: 'Done', Priority: 'P4', Due: now.toISOString().slice(0, 10) })
  createDbItem(tasksDb.id, {
    Title: 'Fix login bug',
    Status: 'In Progress',
    Priority: 'P2',
    Due: inTwoDays.toISOString().slice(0, 10),
  })

  createDbView(tasksDb.id, 'All Tasks', 'table')

  // Expenses database
  if (financesCat) {
    const expensesSchema = JSON.stringify([
      { name: 'Description', type: 'text' },
      { name: 'Amount', type: 'number' },
      { name: 'Category', type: 'select', options: ['Food', 'Transport', 'Bills', 'Entertainment'] },
      { name: 'Date', type: 'date' },
    ])

    const expensesDb = createDatabase('Expenses', financesCat.id, { icon: '💸', schema: expensesSchema }) as any

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const threeDaysAgo = new Date(now)
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    createDbItem(expensesDb.id, {
      Description: 'Grocery shopping',
      Amount: 45.5,
      Category: 'Food',
      Date: yesterday.toISOString().slice(0, 10),
    })
    createDbItem(expensesDb.id, {
      Description: 'Bus ticket',
      Amount: 2.5,
      Category: 'Transport',
      Date: threeDaysAgo.toISOString().slice(0, 10),
    })
    createDbItem(expensesDb.id, {
      Description: 'Netflix',
      Amount: 15.99,
      Category: 'Entertainment',
      Date: now.toISOString().slice(0, 10),
    })

    createDbView(expensesDb.id, 'All Expenses', 'table')

    // --- Accounts ---
    const mainBank = createAccount({
      name: 'Main Bank',
      type: 'bank',
      balance: 2450,
      currency: 'EUR',
      icon: 'Building2',
    }) as any
    const cashAccount = createAccount({
      name: 'Cash',
      type: 'cash',
      balance: 120,
      currency: 'EUR',
      icon: 'Wallet',
    }) as any

    // --- Transactions ---
    const fiveDaysAgo = new Date(now)
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
    const twoDaysAgo = new Date(now)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    createTransaction({
      type: 'income',
      amount: 2800,
      description: 'Monthly salary',
      category: 'Salary',
      date: fiveDaysAgo.toISOString().slice(0, 10),
      accountId: mainBank.id,
    })
    createTransaction({
      type: 'expense',
      amount: 45.5,
      description: 'Grocery shopping',
      category: 'Food',
      date: yesterday.toISOString().slice(0, 10),
      accountId: mainBank.id,
    })
    createTransaction({
      type: 'expense',
      amount: 2.5,
      description: 'Bus ticket',
      category: 'Transport',
      date: threeDaysAgo.toISOString().slice(0, 10),
      accountId: cashAccount.id,
    })
    createTransaction({
      type: 'expense',
      amount: 15.99,
      description: 'Netflix subscription',
      category: 'Entertainment',
      date: twoDaysAgo.toISOString().slice(0, 10),
      accountId: mainBank.id,
    })
  }

  // Mark as seeded
  db.prepare("INSERT INTO planner_meta (key, value) VALUES ('seeded', 'true')").run()
  logger.info('Planner: seeded example content')
}

export function seedLifeOsDefaults(): void {
  const db = getPlannerDb()
  db.exec(`CREATE TABLE IF NOT EXISTS planner_meta (key TEXT PRIMARY KEY, value TEXT)`)

  const row = db.prepare("SELECT value FROM planner_meta WHERE key = 'life_os_seeded'").get() as
    | { value: string }
    | undefined
  if (row) return

  // Default autopilot breakers (from Dan Koe's protocol)
  const breakers = [
    { time: '11:00', question: "What am I avoiding right now by doing what I'm doing?" },
    { time: '13:30', question: 'If someone filmed the last two hours, what would they conclude I want from my life?' },
    { time: '15:15', question: 'Am I moving toward the life I hate or the life I want?' },
    { time: '17:00', question: "What's the most important thing I'm pretending isn't important?" },
    { time: '19:30', question: 'What did I do today out of identity protection rather than genuine desire?' },
    { time: '21:00', question: 'When did I feel most alive today? When did I feel most dead?' },
  ]
  for (const b of breakers) {
    createAutopilotBreaker(b.time, b.question)
  }

  // Empty anti-vision and vision
  createLifeOsComponent('anti-vision', 'Anti-Vision', 'Describe the life you never want to live...', { isActive: true })
  createLifeOsComponent('vision', 'Vision', 'Describe your ideal life in vivid detail...', { isActive: true })

  // Starter identity
  upsertIdentity('I am the type of person who designs their life intentionally.')

  db.prepare("INSERT OR IGNORE INTO planner_meta (key, value) VALUES ('life_os_seeded', 'true')").run()
  logger.info('Life OS: seeded defaults (breakers, vision, identity)')
}
