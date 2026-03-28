import crypto from 'node:crypto'
import { SecretSetSchema } from '@zync/shared/schemas'
import { Router } from 'express'
import { errorResponse } from '../lib/errors.js'
import { validate } from '../lib/validate.js'
import { getSecrets } from '../secrets/index.js'

export const secretsRouter = Router()

function requireVault() {
  const svc = getSecrets()
  if (!svc) throw new Error('Vault not available. Set SECRET_KEY env var.')
  return svc
}

// GET /api/secrets/status — vault availability + PIN status
secretsRouter.get('/status', (_req, res) => {
  const svc = getSecrets()
  const available = !!svc
  const hasPin = available ? svc!.hasPin() : false
  res.json({ available, hasPin })
})

// POST /api/secrets/pin — set or update vault PIN (6 digits)
secretsRouter.post('/pin', (req, res) => {
  try {
    const svc = requireVault()
    const { pin } = req.body
    if (!pin || !/^\d{6}$/.test(pin)) {
      res.status(400).json({ error: 'PIN must be exactly 6 digits' })
      return
    }
    svc.setPin(pin)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
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

// POST /api/secrets/:name/reveal — decrypt and return secret value (accepts PIN or SECRET_KEY)
secretsRouter.post('/:name/reveal', (req, res) => {
  try {
    const svc = requireVault()
    const { pin, secretKey } = req.body

    let authorized = false

    // Try PIN first
    if (pin && /^\d{6}$/.test(pin)) {
      authorized = svc.verifyPin(pin)
    }

    // Fall back to SECRET_KEY
    if (!authorized && secretKey && typeof secretKey === 'string' && secretKey.length >= 32) {
      const serverKey = process.env.SECRET_KEY
      if (serverKey) {
        const a = Buffer.from(secretKey)
        const b = Buffer.from(serverKey)
        authorized = a.length === b.length && crypto.timingSafeEqual(a, b)
      }
    }

    if (!authorized) {
      res.status(403).json({ error: pin ? 'Wrong PIN' : 'Invalid secret key' })
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
