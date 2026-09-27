import { z } from 'zod'

/** An Error carrying the HTTP status the API should answer with (see api/src/app.ts error handler). */
export const httpError = (status: number, message: string) => Object.assign(new Error(message), { status })

export const badRequest = (message: string) => httpError(400, message)

export const notFound = (message: string) => httpError(404, message)

export const conflict = (message: string) => httpError(409, message)

/** A readable message for anything thrown (zod issues are listed field by field). */
export function errorMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => `${i.path.join('.') || 'job'}: ${i.message}`).join('; ')
  }
  return err instanceof Error ? err.message : String(err)
}

/** The HTTP status an error carries (see httpError), if any. */
export function statusOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined
  const { status } = err as { status?: unknown }
  return typeof status === 'number' ? status : undefined
}

/** A Node system error's code ("ENOENT", "EEXIST"…), if any. */
export function codeOf(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined
  const { code } = err as { code?: unknown }
  return typeof code === 'string' ? code : undefined
}
