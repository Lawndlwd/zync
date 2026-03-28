import { Router } from 'express'
import { errorResponse } from '../lib/errors.js'
import {
  createAccount,
  createCategory,
  createGoal,
  createNote,
  createPage,
  createReminder,
  createTransaction,
  deleteAccount,
  deleteCategory,
  deleteGoal,
  deleteNote,
  deletePage,
  deleteReminder,
  deleteTransaction,
  getAccounts,
  getCategories,
  getDashboardStats,
  getGoals,
  getNotes,
  getPage,
  getPages,
  getReminders,
  getTransactions,
  reorderPages,
  updateAccount,
  updateGoal,
  updateNote,
  updatePage,
  updateReminder,
  updateTransaction,
} from '../planner/db.js'
import { blocksuiteDocsRouter } from './blocksuite-docs.js'
import { lifeOsRouter } from './life-os.js'

export const plannerRouter = Router()

// --- BlockSuite document storage ---
plannerRouter.use('/document', blocksuiteDocsRouter)

// --- Life OS (Dan Koe Framework) ---
plannerRouter.use('/life-os', lifeOsRouter)

// --- Categories ---
plannerRouter.get('/categories', (_req, res) => {
  try {
    res.json(getCategories())
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.post('/categories', (req, res) => {
  try {
    const { slug, label, icon, color } = req.body
    if (!slug || !label) {
      res.status(400).json({ error: 'slug and label are required' })
      return
    }
    res.json(createCategory(slug, label, icon || '📁', color || '#f59e0b'))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.delete('/categories/:id', (req, res) => {
  try {
    deleteCategory(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Notes ---
plannerRouter.get('/notes', (req, res) => {
  try {
    res.json(getNotes(req.query.category as string | undefined))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.post('/notes', (req, res) => {
  try {
    const { categoryId, title, content } = req.body
    if (!categoryId || !title) {
      res.status(400).json({ error: 'categoryId and title are required' })
      return
    }
    res.json(createNote(categoryId, title, content))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.put('/notes/:id', (req, res) => {
  try {
    const result = updateNote(req.params.id, req.body)
    if (!result) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.delete('/notes/:id', (req, res) => {
  try {
    deleteNote(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Goals ---
plannerRouter.get('/goals', (req, res) => {
  try {
    res.json(getGoals(req.query.category as string | undefined))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.post('/goals', (req, res) => {
  try {
    const { categoryId, title, description, targetDate } = req.body
    if (!categoryId || !title) {
      res.status(400).json({ error: 'categoryId and title are required' })
      return
    }
    res.json(createGoal(categoryId, title, description, targetDate))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.put('/goals/:id', (req, res) => {
  try {
    const result = updateGoal(req.params.id, req.body)
    if (!result) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.delete('/goals/:id', (req, res) => {
  try {
    deleteGoal(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Reminders ---
plannerRouter.get('/reminders', (req, res) => {
  try {
    res.json(getReminders(req.query.upcoming === 'true'))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.post('/reminders', (req, res) => {
  try {
    const { title, dueAt, description, repeat, linkedGoalId, linkedTodoId } = req.body
    if (!title || !dueAt) {
      res.status(400).json({ error: 'title and dueAt are required' })
      return
    }
    res.json(createReminder(title, dueAt, { description, repeat, linkedGoalId, linkedTodoId }))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.put('/reminders/:id', (req, res) => {
  try {
    const result = updateReminder(req.params.id, req.body)
    if (!result) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.delete('/reminders/:id', (req, res) => {
  try {
    deleteReminder(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Transactions ---
plannerRouter.get('/transactions', (req, res) => {
  try {
    res.json(
      getTransactions({
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        type: req.query.type as string | undefined,
      }),
    )
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.post('/transactions', (req, res) => {
  try {
    const { type, amount, description, date } = req.body
    if (!type || amount === undefined || !description || !date) {
      res.status(400).json({ error: 'type, amount, description, and date are required' })
      return
    }
    res.json(createTransaction(req.body))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.put('/transactions/:id', (req, res) => {
  try {
    const result = updateTransaction(req.params.id, req.body)
    if (!result) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.delete('/transactions/:id', (req, res) => {
  try {
    deleteTransaction(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Accounts ---
plannerRouter.get('/accounts', (_req, res) => {
  try {
    res.json(getAccounts())
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.post('/accounts', (req, res) => {
  try {
    const { name } = req.body
    if (!name) {
      res.status(400).json({ error: 'name is required' })
      return
    }
    res.json(createAccount(req.body))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.put('/accounts/:id', (req, res) => {
  try {
    const result = updateAccount(req.params.id, req.body)
    if (!result) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.delete('/accounts/:id', (req, res) => {
  try {
    deleteAccount(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Pages ---
plannerRouter.get('/pages', (req, res) => {
  try {
    const categoryId = req.query.category as string | undefined
    const parentId = req.query.parent as string | undefined
    const parentVal = parentId === 'null' ? null : parentId
    res.json(getPages(categoryId, parentVal))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.get('/pages/:id', (req, res) => {
  try {
    const page = getPage(req.params.id)
    if (!page) {
      res.status(404).json({ error: 'Page not found' })
      return
    }
    res.json(page)
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.post('/pages', (req, res) => {
  try {
    const { categoryId, title, parentId, icon, content, pageType, pinned, order } = req.body
    if (!categoryId || !title) {
      res.status(400).json({ error: 'categoryId and title are required' })
      return
    }
    res.json(createPage(categoryId, title, { parentId, icon, content, pageType, pinned, order }))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.put('/pages/reorder', (req, res) => {
  try {
    const { items } = req.body
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'items array required' })
      return
    }
    reorderPages(items)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.put('/pages/:id', (req, res) => {
  try {
    const result = updatePage(req.params.id, req.body)
    if (!result) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.delete('/pages/:id', (req, res) => {
  try {
    const success = deletePage(req.params.id)
    if (!success) {
      res.status(400).json({ error: 'Cannot delete system page' })
      return
    }
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Databases ---
import {
  createDatabase,
  createDbItem,
  createDbView,
  deleteDatabase,
  deleteDbItem,
  deleteDbView,
  getDatabase,
  getDatabases,
  getDbItems,
  getDbViews,
  updateDbItem,
  updateDbView,
} from '../planner/databases.js'

plannerRouter.get('/databases', (req, res) => {
  try {
    res.json(getDatabases(req.query.category as string | undefined))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.get('/databases/:id', (req, res) => {
  try {
    const db = getDatabase(req.params.id)
    if (!db) {
      res.status(404).json({ error: 'Database not found' })
      return
    }
    res.json(db)
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.post('/databases', (req, res) => {
  try {
    const { name, categoryId, icon, schema } = req.body
    if (!name || !categoryId) {
      res.status(400).json({ error: 'name and categoryId required' })
      return
    }
    res.json(createDatabase(name, categoryId, { icon, schema: schema ? JSON.stringify(schema) : undefined }))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.delete('/databases/:id', (req, res) => {
  try {
    deleteDatabase(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- DB Items ---
plannerRouter.get('/databases/:dbId/items', (req, res) => {
  try {
    res.json(getDbItems(req.params.dbId))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.post('/databases/:dbId/items', (req, res) => {
  try {
    const { data } = req.body
    if (!data) {
      res.status(400).json({ error: 'data required' })
      return
    }
    res.json(createDbItem(req.params.dbId, data))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.put('/db-items/:id', (req, res) => {
  try {
    const { data } = req.body
    if (!data) {
      res.status(400).json({ error: 'data required' })
      return
    }
    const result = updateDbItem(req.params.id, data)
    if (!result) {
      res.status(404).json({ error: 'Item not found' })
      return
    }
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.delete('/db-items/:id', (req, res) => {
  try {
    deleteDbItem(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- DB Views ---
plannerRouter.get('/databases/:dbId/views', (req, res) => {
  try {
    res.json(getDbViews(req.params.dbId))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.post('/databases/:dbId/views', (req, res) => {
  try {
    const { name, viewType, config } = req.body
    if (!name) {
      res.status(400).json({ error: 'name required' })
      return
    }
    res.json(createDbView(req.params.dbId, name, viewType || 'table', config))
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.put('/db-views/:id', (req, res) => {
  try {
    const result = updateDbView(req.params.id, req.body)
    if (!result) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

plannerRouter.delete('/db-views/:id', (req, res) => {
  try {
    deleteDbView(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Dashboard Stats ---
plannerRouter.get('/dashboard-stats', (_req, res) => {
  try {
    res.json(getDashboardStats())
  } catch (err) {
    errorResponse(res, err)
  }
})
