import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'

export function validate<T extends ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.flatten() })
      return
    }
    req.body = result.data
    next()
  }
}
