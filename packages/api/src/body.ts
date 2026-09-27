import { MEMORY_TYPES } from '@zync/jobs'
import { z } from 'zod'

import { LIBRARY_KINDS } from './opencode-library.js'

// Request bodies, validated where they enter the API. A failed parse throws a ZodError, which the
// error handler (middleware/error-handler.ts) answers with 400 and the issues. Deeper rules (cron syntax, column ids,
// dates…) stay in @zync/jobs, next to the files they describe.

const text = z.string()
const trimmed = z.string().trim()

export const WorkspaceBody = z.object({ name: trimmed })

export const PersonBody = z.object({ name: text, color: text.optional() })
export const PersonPatchBody = z.object({ name: text.optional(), color: text.optional() })

const Columns = z.array(z.object({ id: text, name: text }))
export const BoardBody = z.object({ name: text, parent: text.optional(), columns: Columns.optional() })
export const BoardPatchBody = z.object({ name: text.optional(), columns: Columns.optional() })

export const JobPatchBody = z.object({ enabled: z.boolean().optional(), at: text.optional() })

export const MemoryPatchBody = z.object({
  title: text.optional(),
  type: z.enum(MEMORY_TYPES).nullable().optional(),
  description: text.nullable().optional(),
  pinned: z.boolean().optional(),
  body: text.optional(),
})
export const MemoryBody = MemoryPatchBody.extend({ title: trimmed.min(1, 'A memory needs a title') })
export const PersonNotesBody = z.object({ notes: text.default('') })

export const LibraryItemBody = z.object({
  kind: z.enum(LIBRARY_KINDS, { message: 'kind must be agent, command or skill' }),
  name: text,
  description: text.optional(),
})

export const OrderBody = z.object({ dir: text.default(''), names: z.array(text).default([]) })
export const FolderBody = z.object({ path: text })
export const MoveBody = z.object({ from: text, to: text })

// ── auth ──

const b64url = z
  .string()
  .regex(/^[\w-]+$/)
  .max(8192)

/** A passkey's answer to "create a credential" (navigator.credentials.create, as JSON). */
export const RegistrationBody = z.object({
  response: z.object({
    id: b64url,
    rawId: b64url,
    type: z.literal('public-key'),
    response: z.object({
      clientDataJSON: b64url,
      attestationObject: b64url,
      /** Hints for later sign-ins; values this server doesn't know are dropped, not refused. */
      transports: z.array(z.string().max(20)).max(10).optional(),
    }),
  }),
  name: z.string().trim().max(60).default(''),
})

/** A passkey's answer to "sign this challenge" (navigator.credentials.get, as JSON). */
export const AuthenticationBody = z.object({
  response: z.object({
    id: b64url,
    rawId: b64url,
    type: z.literal('public-key'),
    response: z.object({ clientDataJSON: b64url, authenticatorData: b64url, signature: b64url }),
  }),
})

/** The setup code (printed in the server log) or a recovery code. */
export const CodeBody = z.object({ code: z.string().trim().min(1).max(64) })
