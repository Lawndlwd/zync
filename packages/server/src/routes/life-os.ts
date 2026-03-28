import { Router } from 'express'
import { errorResponse } from '../lib/errors.js'
import {
  awardXp,
  createAutopilotBreaker,
  createDailyLever,
  createLifeOsComponent,
  deleteAutopilotBreaker,
  deleteDailyLever,
  deleteJournalEntry,
  deleteLifeOsComponent,
  getAutopilotBreakers,
  getDailyLevers,
  getIdentity,
  getJournalEntries,
  getJournalEntry,
  getJournalStreak,
  getLifeOsComponentByType,
  getLifeOsComponents,
  getLifeOsStats,
  getPsyScores,
  getPsyScoreToday,
  getXpEvents,
  toggleDailyLever,
  updateAutopilotBreaker,
  updateDailyLever,
  updateLifeOsComponent,
  upsertIdentity,
  upsertJournalEntry,
  upsertPsyScore,
} from '../planner/db.js'
import {
  createGoal,
  createGoalTask,
  deleteGoal,
  deleteGoalTask,
  getGoal,
  getGoalChildren,
  getGoalRoots,
  getGoalTasks,
  scaffoldChildren,
  syncComponentToGoal,
  toggleGoalTask,
  updateGoal,
} from '../planner/goals.js'

export const lifeOsRouter = Router()

// --- Components ---
lifeOsRouter.get('/components', (_req, res) => {
  try {
    res.json(getLifeOsComponents())
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.get('/components/:type', (req, res) => {
  try {
    const component = getLifeOsComponentByType(req.params.type)
    res.json(component || null)
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.post('/components', (req, res) => {
  try {
    const { type, title, content, targetDate, isActive } = req.body
    if (!type || !title) {
      res.status(400).json({ error: 'type and title required' })
      return
    }
    const comp = createLifeOsComponent(type, title, content, { targetDate, isActive }) as any
    // Sync to Projects: auto-create a linked goal for year/month types
    if (comp && (type === 'one-year-goal' || type === 'one-month-project')) {
      syncComponentToGoal(comp.id, type, title, content || '', targetDate || null)
    }
    // Re-fetch to include linked_goal_id
    res.json(getLifeOsComponentByType(type) || comp)
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.put('/components/:id', (req, res) => {
  try {
    const result = updateLifeOsComponent(req.params.id, req.body) as any
    if (!result) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }
    // Sync to Projects: update linked goal
    if (result.type === 'one-year-goal' || result.type === 'one-month-project') {
      syncComponentToGoal(result.id, result.type, result.title, result.content || '', result.target_date || null)
    }
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.delete('/components/:id', (req, res) => {
  try {
    deleteLifeOsComponent(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Identity ---
lifeOsRouter.get('/identity', (_req, res) => {
  try {
    res.json(getIdentity() || null)
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.post('/identity', (req, res) => {
  try {
    const { statement } = req.body
    if (!statement) {
      res.status(400).json({ error: 'statement required' })
      return
    }
    res.json(upsertIdentity(statement))
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Daily Levers ---
lifeOsRouter.get('/levers', (req, res) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10)
    res.json(getDailyLevers(date))
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.post('/levers', (req, res) => {
  try {
    const { title, date, projectId, order } = req.body
    if (!title || !date) {
      res.status(400).json({ error: 'title and date required' })
      return
    }
    res.json(createDailyLever(title, date, { projectId, order }))
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.put('/levers/:id/toggle', (req, res) => {
  try {
    const result = toggleDailyLever(req.params.id)
    if (!result) {
      res.status(404).json({ error: 'Lever not found' })
      return
    }
    // Award XP if just completed
    const lever = result as any
    if (lever.completed) {
      const today = new Date().toISOString().slice(0, 10)
      awardXp('lever_completed', 50, `Completed lever: ${lever.title}`, today)
      // Check if all levers are now complete
      const allLevers = getDailyLevers(lever.date) as any[]
      if (allLevers.length > 0 && allLevers.every((l: any) => l.completed)) {
        awardXp('all_levers', 150, 'All daily levers completed!', today)
      }
    }
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.put('/levers/:id', (req, res) => {
  try {
    const result = updateDailyLever(req.params.id, req.body)
    if (!result) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.delete('/levers/:id', (req, res) => {
  try {
    deleteDailyLever(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Autopilot Breakers ---
lifeOsRouter.get('/breakers', (_req, res) => {
  try {
    res.json(getAutopilotBreakers())
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.post('/breakers', (req, res) => {
  try {
    const { time, question } = req.body
    if (!time || !question) {
      res.status(400).json({ error: 'time and question required' })
      return
    }
    res.json(createAutopilotBreaker(time, question))
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.put('/breakers/:id', (req, res) => {
  try {
    const result = updateAutopilotBreaker(req.params.id, req.body)
    if (!result) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.delete('/breakers/:id', (req, res) => {
  try {
    deleteAutopilotBreaker(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Journal ---
lifeOsRouter.get('/journal', (req, res) => {
  try {
    const { date, type, from, to } = req.query as Record<string, string>
    if (date && type) {
      res.json(getJournalEntry(date, type) || null)
    } else {
      res.json(getJournalEntries({ from, to, type }))
    }
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.post('/journal', (req, res) => {
  try {
    const { date, type, responses, pageId, completedAt } = req.body
    if (!date || !type || !responses) {
      res.status(400).json({ error: 'date, type, and responses required' })
      return
    }
    const result = upsertJournalEntry(date, type, responses, { pageId, completedAt })
    // Award XP if completing a protocol
    if (completedAt) {
      const today = new Date().toISOString().slice(0, 10)
      if (type === 'morning') {
        awardXp('morning_protocol', 100, 'Completed morning protocol', today)
      } else if (type === 'evening') {
        awardXp('evening_synthesis', 100, 'Completed evening synthesis', today)
      }
    }
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.delete('/journal/:id', (req, res) => {
  try {
    deleteJournalEntry(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- XP ---
lifeOsRouter.get('/xp', (req, res) => {
  try {
    res.json(getXpEvents({ from: req.query.from as string, to: req.query.to as string }))
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.post('/xp', (req, res) => {
  try {
    const { type, xp, description, date } = req.body
    if (!type || xp === undefined || !description || !date) {
      res.status(400).json({ error: 'type, xp, description, and date required' })
      return
    }
    res.json(awardXp(type, xp, description, date))
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Stats ---
lifeOsRouter.get('/stats', (_req, res) => {
  try {
    res.json(getLifeOsStats())
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Goals (Fractal Drill-Down) ---
lifeOsRouter.get('/goals', (req, res) => {
  try {
    res.json(getGoalRoots(req.query.status as string | undefined))
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.get('/goals/:id', (req, res) => {
  try {
    const result = getGoal(req.params.id)
    if (!result) {
      res.status(404).json({ error: 'Goal not found' })
      return
    }
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.get('/goals/:id/children', (req, res) => {
  try {
    res.json(getGoalChildren(req.params.id))
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.post('/goals', (req, res) => {
  try {
    const { granularity, title, startDate, endDate, parentId } = req.body
    if (!granularity || !title || !startDate || !endDate) {
      res.status(400).json({ error: 'granularity, title, startDate, and endDate required' })
      return
    }
    res.json(createGoal(granularity, title, startDate, endDate, { parentId }))
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.put('/goals/:id', (req, res) => {
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

lifeOsRouter.delete('/goals/:id', (req, res) => {
  try {
    deleteGoal(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.post('/goals/:id/scaffold', (req, res) => {
  try {
    res.json(scaffoldChildren(req.params.id))
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Goal Tasks ---
lifeOsRouter.get('/goals/:goalId/tasks', (req, res) => {
  try {
    res.json(getGoalTasks(req.params.goalId))
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.post('/goals/:goalId/tasks', (req, res) => {
  try {
    const { title } = req.body
    if (!title) {
      res.status(400).json({ error: 'title required' })
      return
    }
    res.json(createGoalTask(req.params.goalId, title))
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.put('/goal-tasks/:id/toggle', (req, res) => {
  try {
    const result = toggleGoalTask(req.params.id)
    if (!result) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.delete('/goal-tasks/:id', (req, res) => {
  try {
    deleteGoalTask(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Psychology Tracker ---
lifeOsRouter.get('/psy-tracker', (req, res) => {
  try {
    const days = parseInt(String(req.query.days || '30'), 10)
    res.json(getPsyScores(days))
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.get('/psy-tracker/today', (_req, res) => {
  try {
    res.json(getPsyScoreToday() || null)
  } catch (err) {
    errorResponse(res, err)
  }
})

lifeOsRouter.post('/psy-tracker', (req, res) => {
  try {
    const { date, score, note } = req.body
    if (!date || !score) {
      res.status(400).json({ error: 'date and score required' })
      return
    }
    res.json(upsertPsyScore(date, score, note))
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Journal Streak ---
lifeOsRouter.get('/journal-streak', (_req, res) => {
  try {
    res.json(getJournalStreak())
  } catch (err) {
    errorResponse(res, err)
  }
})
