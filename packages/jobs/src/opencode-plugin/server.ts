import path from 'node:path'

import { Plugin } from '@opencode/plugin'
import { z } from 'zod'

import { buildBecomingPrompt } from '../becoming/prompt.js'
import { errorMessage } from '../errors.js'
import {
  buildMemoryPrompt,
  deleteMemory,
  globalMemoryDir,
  MEMORY_TYPES,
  type MemoryContext,
  type MemoryScope,
  memoryFile,
  readMemory,
  saveMemory,
  searchMemory,
  workspaceMemoryDir,
} from '../memory/index.js'
import { createPerson, findPerson, readPersonNotes, writePersonNotes } from '../people/index.js'
import { buildTrainingPrompt } from '../training/prompt.js'
import { workspacesRoot } from '../workspaces.js'

// zync's opencode plugin (v2 plugin API): the AI's memory (see memory/). configure.mjs adds this
// folder (dist/opencode-plugin, loaded through its server.js) to the opencode config's `plugins`.
// opencode starts one instance per location (folder), so `ctx.location.directory` is the folder of
// the sessions it serves. It
//   - adds the memory block (people notes, pinned memories, index) to every model request, and the
//     Becoming block (identities, guards) when the workspace has identities, and the Training block
//     (goal, routines, today) once the training profile is set up,
//   - nudges the AI to save when the user says "remember…", "from now on…",
//   - gives it memory_* and person_* tools.

type ToolDef = {
  name: string
  description: string
  input: z.core.JSONSchema.BaseSchema
  execute: (input: unknown) => Promise<{ content: string }>
}

/** A tool whose input is checked (and typed) by its own schema. Errors come back as text: the model
 * reads them and can correct itself. */
function tool<S extends z.ZodRawShape>(def: {
  name: string
  description: string
  args: S
  execute: (args: z.infer<z.ZodObject<S>>) => Promise<string>
}): ToolDef {
  const schema = z.object(def.args)
  return {
    name: def.name,
    description: def.description,
    input: z.toJSONSchema(schema),
    execute: async (input) => {
      try {
        return { content: await def.execute(schema.parse(input)) }
      } catch (err) {
        return { content: `Error: ${errorMessage(err)}` }
      }
    },
  }
}

/** The workspace folder a directory belongs to (first level under the root), if any. */
export function workspaceOf(directory: string, root: string): string | undefined {
  const rel = path.relative(root, path.resolve(directory))
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return undefined
  const name = rel.split(path.sep)[0] ?? ''
  return name.startsWith('.') ? undefined : path.join(root, name)
}

const REMEMBER =
  /\b(remember|don'?t forget|keep in mind|from now on|note that|i prefer|i like|i hate|i usually|souviens|retiens|n'oublie pas|dorénavant|désormais)\b/i

const NUDGE =
  'The latest user message may contain something to remember (a preference, a rule, a fact about someone). If it is durable, save it now with memory_save or person_note.'

/** The system blocks for a folder: memory, plus Becoming and Training when the workspace uses them. */
export async function systemBlocks(ctx: MemoryContext): Promise<string[]> {
  const blocks = [await buildMemoryPrompt(ctx)]
  const becoming = ctx.wsPath ? await buildBecomingPrompt(ctx.wsPath) : ''
  if (becoming) blocks.push(becoming)
  const training = ctx.wsPath ? await buildTrainingPrompt(ctx.wsPath) : ''
  if (training) blocks.push(training)
  return blocks
}

export function memoryTools(directory: string, root: string): ToolDef[] {
  const ctx: MemoryContext = { root, wsPath: workspaceOf(directory, root) }
  const dirOf = (scope: MemoryScope) => {
    if (scope === 'global') return globalMemoryDir(root)
    if (!ctx.wsPath) throw new Error('No current workspace here: use scope "global".')
    return workspaceMemoryDir(ctx.wsPath)
  }
  const scopeArg = z
    .enum(['workspace', 'global'])
    .describe('"workspace" = only this workspace; "global" = everywhere (about the user, general preferences).')

  return [
    tool({
      name: 'memory_save',
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
      execute: async (a) => {
        const { memory, created } = await saveMemory(dirOf(a.scope), a.scope, {
          title: a.title,
          body: a.content,
          description: a.description,
          type: a.type,
          pinned: a.pinned,
        })
        return `${created ? 'Saved' : 'Updated'} memory "${memory.title}" (${memory.scope}).`
      },
    }),

    tool({
      name: 'memory_read',
      description: 'Read a memory in full, by title (from the memory index in your instructions).',
      args: { title: z.string(), scope: scopeArg.optional().describe('Omit to look in the workspace, then global.') },
      execute: async (a) => {
        const scopes: MemoryScope[] = a.scope ? [a.scope] : ['workspace', 'global']
        for (const scope of scopes) {
          let dir: string
          try {
            dir = dirOf(scope)
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
      },
    }),

    tool({
      name: 'memory_search',
      description: 'Search your memories and people notes by words.',
      args: { query: z.string() },
      execute: async (a) => {
        const hits = await searchMemory(a.query, ctx)
        if (!hits.length) return 'Nothing found.'
        return hits
          .map((h) => `## ${h.kind === 'person' ? `person ${h.title}` : `${h.title} [${h.scope}]`}\n${h.snippet}`)
          .join('\n\n')
      },
    }),

    tool({
      name: 'memory_delete',
      description: 'Delete a memory that is wrong or no longer useful.',
      args: { title: z.string(), scope: scopeArg },
      execute: async (a) => {
        await deleteMemory(dirOf(a.scope), memoryFile(a.title))
        return `Deleted memory "${a.title}".`
      },
    }),

    tool({
      name: 'person_read',
      description: 'Read your full note about a person (the user is "me").',
      args: { person: z.string().describe('Person id ("me", "sofia") or name.') },
      execute: async (a) => {
        const p = await findPerson(a.person, root)
        if (!p) return `Unknown person "${a.person}".`
        return (await readPersonNotes(p.id, root)) || `No notes about ${p.name} yet.`
      },
    }),

    tool({
      name: 'person_note',
      description:
        'Write what you know about a person: who they are, their role, how to work with them, their preferences. ' +
        'The user is "me"; "ai" is the note about how you should work. Replaces the note: person_read it first and send the full, merged note. ' +
        'A name that is not a known person adds them to People.',
      args: {
        person: z.string().describe('Person id ("me", "sofia") or name.'),
        note: z.string().describe('The complete note, in markdown.'),
      },
      execute: async (a) => {
        let p = await findPerson(a.person, root)
        let added = ''
        if (!p) {
          p = await createPerson({ name: a.person.replace(/^@/, '').trim() }, root)
          added = ` Added ${p.name} to People as @${p.id}.`
        }
        await writePersonNotes(p.id, a.note, root)
        return `Saved the note about ${p.name} (@${p.id}).${added}`
      },
    }),
  ]
}

export default Plugin.define({
  id: 'zync.memory',
  async setup(ctx) {
    const root = workspacesRoot()
    const directory = ctx.location.directory
    /** Sessions whose latest user message looks like "remember this". */
    const nudge = new Map<string, boolean>()

    await ctx.session.hook('prompt', (e) => {
      nudge.set(e.sessionID, REMEMBER.test(e.prompt.text))
    })

    await ctx.session.hook('context', async (e) => {
      try {
        for (const text of await systemBlocks({ root, wsPath: workspaceOf(directory, root) }))
          e.system.push({ type: 'text', text })
        if (nudge.get(e.sessionID)) e.system.push({ type: 'text', text: NUDGE })
      } catch (err) {
        console.error('[zync-memory]', err)
      }
    })

    const tools = memoryTools(directory, root)
    await ctx.tool.transform((editor) => {
      for (const t of tools) editor.add(t)
    })
  },
})
