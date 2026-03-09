import { Router } from 'express'
import { errorResponse } from '../lib/errors.js'
import { getProfile, updateProfileSection, type ProfileSection } from '../memory/profile.js'
import { getAllInstructions, addInstruction, updateInstruction, deleteInstruction } from '../memory/instructions.js'
import { listMemories, deleteMemoryById, getMemoryCount, listMemoryCategories } from '../memory/memories.js'
import { hybridSearch } from '../memory/search.js'
import { checkpointBrainDb } from '../memory/brain-db.js'

export const memoryRouter = Router()

// Checkpoint WAL before reads so cross-process MCP writes are visible
memoryRouter.use((_req, _res, next) => {
  checkpointBrainDb()
  next()
})

// ── Profile ──────────────────────────────────────────────────────────

memoryRouter.get('/profile', (_req, res) => {
  try {
    const entries = getProfile()
    res.json(entries)
  } catch (err) {
    errorResponse(res, err)
  }
})

memoryRouter.put('/profile/:section', (req, res) => {
  try {
    const { section } = req.params
    const { content } = req.body
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'content must be a string' })
    }
    updateProfileSection(section as ProfileSection, content)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// ── Instructions ─────────────────────────────────────────────────────

memoryRouter.get('/instructions', (_req, res) => {
  try {
    const instructions = getAllInstructions()
    res.json(instructions)
  } catch (err) {
    errorResponse(res, err)
  }
})

memoryRouter.post('/instructions', (req, res) => {
  try {
    const { content } = req.body
    if (typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'content must be a non-empty string' })
    }
    const result = addInstruction(content, 'explicit')
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

memoryRouter.put('/instructions/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { content, active } = req.body
    const success = updateInstruction(id, { content, active })
    res.json({ success })
  } catch (err) {
    errorResponse(res, err)
  }
})

memoryRouter.delete('/instructions/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const success = deleteInstruction(id)
    res.json({ success })
  } catch (err) {
    errorResponse(res, err)
  }
})

// ── Memories ─────────────────────────────────────────────────────────

memoryRouter.get('/memories', async (req, res) => {
  try {
    const { q, category, limit, offset } = req.query

    if (typeof q === 'string' && q.trim().length > 0) {
      const results = await hybridSearch(q, limit ? Number(limit) : undefined)
      return res.json(results)
    }

    const memories = listMemories({
      category: category as string | undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    })
    res.json(memories)
  } catch (err) {
    errorResponse(res, err)
  }
})

memoryRouter.get('/memories/categories', (_req, res) => {
  try {
    const categories = listMemoryCategories()
    res.json(categories)
  } catch (err) {
    errorResponse(res, err)
  }
})

memoryRouter.get('/memories/count', (_req, res) => {
  try {
    const count = getMemoryCount()
    res.json({ count })
  } catch (err) {
    errorResponse(res, err)
  }
})

memoryRouter.delete('/memories/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const success = deleteMemoryById(id)
    res.json({ success })
  } catch (err) {
    errorResponse(res, err)
  }
})
