import crypto from 'node:crypto'
import { Router } from 'express'
import { getSecrets } from '../secrets/index.js'
import { validate } from '../lib/validate.js'
import { errorResponse } from '../lib/errors.js'
import { SecretSetSchema, SecretRevealSchema } from '@zync/shared/schemas'

export const secretsRouter = Router()

function requireVault() {
  const svc = getSecrets()
  if (!svc) throw new Error('Vault not available. Set SECRET_KEY env var.')
  return svc
}

// GET /api/secrets/status — vault availability (must be before /:name)
secretsRouter.get('/status', (_req, res) => {
  const available = !!getSecrets()
  res.json({ available })
})

// GET /api/secrets — list all secrets (metadata only, no values)
secretsRouter.get('/', (_req, res) => {
  try {
    const svc = requireVault()
    const category = typeof _req.query.category === 'string' ? _req.query.category : undefined
    res.json(svc.list(category))
  } catch (err) {
    errorResponse(res, err)
  }
})

// PUT /api/secrets — set a secret
secretsRouter.put('/', validate(SecretSetSchema), (req, res) => {
  try {
    const svc = requireVault()
    const { name, value, category } = req.body
    svc.set(name, value, category)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/secrets/:name/reveal — decrypt and return secret value
secretsRouter.post('/:name/reveal', validate(SecretRevealSchema), (req, res) => {
  try {
    const svc = requireVault()
    const { secretKey } = req.body

    const serverKey = process.env.SECRET_KEY
    if (!serverKey) {
      res.status(403).json({ error: 'Invalid secret key' })
      return
    }
    const a = Buffer.from(secretKey)
    const b = Buffer.from(serverKey)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(403).json({ error: 'Invalid secret key' })
      return
    }

    const value = svc.get(req.params.name as string)
    if (value === null) {
      res.status(404).json({ error: 'Secret not found' })
      return
    }

    res.json({ value })
  } catch (err) {
    errorResponse(res, err)
  }
})

// DELETE /api/secrets/:name — delete a secret
secretsRouter.delete('/:name', (req, res) => {
  try {
    const svc = requireVault()
    const deleted = svc.delete(req.params.name)
    res.json({ success: true, deleted })
  } catch (err) {
    errorResponse(res, err)
  }
})
