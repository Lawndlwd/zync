import { Router } from 'express'
import { getConfigService } from '../config/index.js'
import { validate } from '../lib/validate.js'
import { errorResponse } from '../lib/errors.js'
import { ConfigSetSchema, ConfigBulkSetSchema } from '../lib/schemas.js'

const configRouter = Router()

function requireConfig() {
  const svc = getConfigService()
  if (!svc) throw new Error('ConfigService not available.')
  return svc
}

// GET /api/config — list all settings (optionally ?category=X)
configRouter.get('/', (req, res) => {
  try {
    const svc = requireConfig()
    const category = typeof req.query.category === 'string' ? req.query.category : undefined
    res.json(svc.list(category))
  } catch (err) {
    errorResponse(res, err)
  }
})

// PUT /api/config/:key — upsert a setting
configRouter.put('/:key', validate(ConfigSetSchema), (req, res) => {
  try {
    const svc = requireConfig()
    const { value, category } = req.body
    svc.set(req.params.key as string, value, category)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// DELETE /api/config/:key — reset to default (delete)
configRouter.delete('/:key', (req, res) => {
  try {
    const svc = requireConfig()
    const deleted = svc.delete(req.params.key as string)
    res.json({ success: true, deleted })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/config/bulk — bulk upsert array
configRouter.post('/bulk', validate(ConfigBulkSetSchema), (req, res) => {
  try {
    const svc = requireConfig()
    svc.bulkSet(req.body)
    res.json({ success: true, count: req.body.length })
  } catch (err) {
    errorResponse(res, err)
  }
})

export default configRouter
