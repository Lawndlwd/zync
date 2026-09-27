import path from 'node:path'
import { z } from 'zod'
import {
  buildMemoryPrompt,
  deleteMemory,
  findPerson,
  globalMemoryDir,
  MEMORY_TYPES,
  type MemoryContext,
  type MemoryScope,
  memoryFile,
  readMemory,
  readPersonNotes,
  saveMemory,
  searchMemory,
  workspaceMemoryDir,
  writePersonNotes,
} from './memory.js'
import { createPerson } from './people.js'
import { workspacesRoot } from './workspaces.js'

// zync's opencode plugin: the AI's memory (see memory.ts). configure.mjs adds it to the opencode
// config as file://…/dist/opencode-plugin.js. It
//   - adds the memory block (people notes, pinned memories, index) to every system prompt,
//   - nudges the AI to save when the user says "remember…", "from now on…",
//   - gives it memory_* and person_* tools.
// opencode treats every exported function as a plugin, so this module exports only ZyncMemory.
// The types below are the parts of @opencode-ai/plugin we use (that package drags in a UI stack).

interface ToolContext {
  sessionID: string
  directory: string
}
interface ToolDef {
  description: string
  args: z.ZodRawShape
  execute(args: any, ctx: ToolContext): Promise<string>
}
interface Part {
  type: string
  text?: string
  synthetic?: boolean
}
interface Hooks {
  tool?: Record<string, ToolDef>
  'chat.message'?: (input: { sessionID: string }, output: { parts: Part[] }) => Promise<void>
  'experimental.chat.system.transform'?: (input: { sessionID?: string }, output: { system: string[] }) => Promise<void>
}

/** The workspace folder a directory belongs to (first level under the root), if any. */
function workspaceOf(directory: string, root: string): string | undefined {
  const rel = path.relative(root, path.resolve(directory))
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return undefined
  const name = rel.split(path.sep)[0]
  return name.startsWith('.') ? undefined : path.join(root, name)
}

const REMEMBER =
  /\b(remember|don'?t forget|keep in mind|from now on|note that|i prefer|i like|i hate|i usually|souviens|retiens|n'oublie pas|dorénavant|désormais)\b/i

export async function ZyncMemory({ directory }: { directory: string }): Promise<Hooks> {
  const root = workspacesRoot()
  const ctxOf = (dir = directory): MemoryContext => ({ root, wsPath: workspaceOf(dir, root) })
  const dirOf = (scope: MemoryScope, dir: string) => {
    if (scope === 'global') return globalMemoryDir(root)
    const ws = workspaceOf(dir, root)
    if (!ws) throw new Error('No current workspace here: use scope "global".')
    return workspaceMemoryDir(ws)
  }
  /** Tools report errors as text: the model reads them and can correct itself. */
  const safely = (fn: (args: any, ctx: ToolContext) => Promise<string>) => async (args: any, ctx: ToolContext) => {
    try {
      return await fn(args, ctx)
    } catch (err) {
      return `Error: ${(err as Error).message}`
    }
  }
  const scopeArg = z
    .enum(['workspace', 'global'])
    .describe('"workspace" = only this workspace; "global" = everywhere (about the user, general preferences).')
  /** Sessions whose latest user message looks like "remember this" (title requests share the id). */
  const nudge = new Map<string, boolean>()

  return {
    'chat.message': async (input, output) => {
      const text = output.parts
        .filter((p) => p.type === 'text' && !p.synthetic)
        .map((p) => p.text ?? '')
        .join('\n')
      nudge.set(input.sessionID, REMEMBER.test(text))
    },

    'experimental.chat.system.transform': async (input, output) => {
      try {
        output.system.push(await buildMemoryPrompt(ctxOf()))
        if (input.sessionID && nudge.get(input.sessionID))
          output.system.push(
            'The latest user message may contain something to remember (a preference, a rule, a fact about someone). If it is durable, save it now with memory_save or person_note.',
          )
      } catch (err) {
        console.error('[zync-memory]', err)
      }
    },

    tool: {
      memory_save: {
        description:
          'Save something to your persistent memory, or update it: saving with an existing title replaces that memory. ' +
          'Use for durable knowledge: rules and corrections from the user, preferences, habits (how they usually do things), project facts. ' +
          'To change an existing memory, memory_read it first and save the merged text.',
        args: {
          title: z.string().describe('Short, specific title; it is the file name. E.g. "Commit message style".'),
          content: z.string().describe('The memory in markdown. Self-contained; include the why when you know it.'),
          description: z.string().describe('One line saying what this is about; shown in the memory index.'),
          type: z
            .enum(MEMORY_TYPES)
            .describe(
              'rule = instruction to follow · preference = what the user likes · habit = how they usually work · fact = context',
            ),
          scope: scopeArg,
          pinned: z
            .boolean()
            .optional()
            .describe('Keep the full text in every prompt. Only for short, always-relevant rules.'),
        },
        execute: safely(async (a, ctx) => {
          const { memory, created } = await saveMemory(dirOf(a.scope, ctx.directory), a.scope, {
            title: a.title,
            body: a.content,
            description: a.description,
            type: a.type,
            pinned: a.pinned,
          })
          return `${created ? 'Saved' : 'Updated'} memory "${memory.title}" (${memory.scope}).`
        }),
      },

      memory_read: {
        description: 'Read a memory in full, by title (from the memory index in your instructions).',
        args: { title: z.string(), scope: scopeArg.optional().describe('Omit to look in the workspace, then global.') },
        execute: safely(async (a, ctx) => {
          const scopes: MemoryScope[] = a.scope ? [a.scope] : ['workspace', 'global']
          for (const scope of scopes) {
            let dir: string
            try {
              dir = dirOf(scope, ctx.directory)
            } catch {
              continue
            }
            const m = await readMemory(dir, a.title, scope).catch(() => null)
            if (m)
              return [
                `# ${m.title}`,
                `scope: ${m.scope}${m.type ? ` · type: ${m.type}` : ''}${m.pinned ? ' · pinned' : ''} · updated: ${m.updated.slice(0, 10)}`,
                m.description ? `description: ${m.description}` : '',
                '',
                m.body,
              ].join('\n')
          }
          return `No memory titled "${a.title}".`
        }),
      },

      memory_search: {
        description: 'Search your memories and people notes by words.',
        args: { query: z.string() },
        execute: safely(async (a, ctx) => {
          const hits = await searchMemory(a.query, ctxOf(ctx.directory))
          if (!hits.length) return 'Nothing found.'
          return hits
            .map((h) => `## ${h.kind === 'person' ? `person ${h.title}` : `${h.title} [${h.scope}]`}\n${h.snippet}`)
            .join('\n\n')
        }),
      },

      memory_delete: {
        description: 'Delete a memory that is wrong or no longer useful.',
        args: { title: z.string(), scope: scopeArg },
        execute: safely(async (a, ctx) => {
          await deleteMemory(dirOf(a.scope, ctx.directory), memoryFile(a.title))
          return `Deleted memory "${a.title}".`
        }),
      },

      person_read: {
        description: 'Read your full note about a person (the user is "me").',
        args: { person: z.string().describe('Person id ("me", "sofia") or name.') },
        execute: safely(async (a) => {
          const p = await findPerson(a.person, root)
          if (!p) return `Unknown person "${a.person}".`
          return (await readPersonNotes(p.id, root)) || `No notes about ${p.name} yet.`
        }),
      },

      person_note: {
        description:
          'Write what you know about a person: who they are, their role, how to work with them, their preferences. ' +
          'The user is "me"; "ai" is the note about how you should work. Replaces the note: person_read it first and send the full, merged note. ' +
          'A name that is not a known person adds them to People.',
        args: {
          person: z.string().describe('Person id ("me", "sofia") or name.'),
          note: z.string().describe('The complete note, in markdown.'),
        },
        execute: safely(async (a) => {
          let p = await findPerson(a.person, root)
          let added = ''
          if (!p) {
            p = await createPerson({ name: a.person.replace(/^@/, '').trim() }, root)
            added = ` Added ${p.name} to People as @${p.id}.`
          }
          await writePersonNotes(p.id, a.note, root)
          return `Saved the note about ${p.name} (@${p.id}).${added}`
        }),
      },
    },
  }
}
