import { z } from 'zod'
import { getBrainDb } from '../../memory/brain-db.js'
import { addInstruction, deleteInstruction, getActiveInstructions } from '../../memory/instructions.js'
import { deleteMemoryById, saveMemoryWithDedup } from '../../memory/memories.js'
import { getProfile, type ProfileSection, updateProfileSection } from '../../memory/profile.js'
import { hybridSearch } from '../../memory/search.js'

function logTool(name: string, input: unknown) {
  console.error(`[MCP-TOOL] ${name} called with:`, JSON.stringify(input))
}

/** Force WAL data into the main DB file so Docker-mounted reads see it */
function flushWal() {
  try {
    getBrainDb().pragma('wal_checkpoint(FULL)')
  } catch {
    /* ignore */
  }
}

// --- update_profile ---
export const updateProfileSchema = z.object({
  section: z
    .enum(['identity', 'technical', 'interests', 'communication', 'work_patterns'])
    .describe('Profile section to update'),
  content: z.string().describe('New content for this section (markdown)'),
})

export async function updateProfileHandler(input: z.infer<typeof updateProfileSchema>) {
  logTool('update_profile', input)
  updateProfileSection(input.section as ProfileSection, input.content)
  flushWal()
  return `Updated profile section '${input.section}'`
}

// --- save_instruction ---
export const saveInstructionSchema = z.object({
  content: z.string().describe('The instruction to save (e.g. "Always use TypeScript", "Never add emojis")'),
})

export async function saveInstructionHandler(input: z.infer<typeof saveInstructionSchema>) {
  logTool('save_instruction', input)
  const { id } = addInstruction(input.content, 'explicit')
  flushWal()
  return `Saved instruction #${id}: "${input.content}"`
}

// --- save_memory ---
export const saveMemorySchema = z.object({
  content: z.string().describe('The information to remember'),
  category: z.string().default('general').describe('Memory category (preference, fact, project, person, decision)'),
})

export async function saveMemoryHandler(input: z.infer<typeof saveMemorySchema>) {
  logTool('save_memory', input)
  const { id, merged } = await saveMemoryWithDedup(input.content, input.category, 'tool')
  flushWal()
  if (merged) return `Merged with existing memory #${id}`
  return `Saved memory #${id} in category '${input.category}'`
}

// --- recall ---
export const searchMemorySchema = z.object({
  query: z.string().describe('Search query'),
  limit: z.number().default(5).describe('Max results to return (default 5)'),
})

export async function searchMemoryHandler(input: z.infer<typeof searchMemorySchema>) {
  const parts: string[] = []

  // Always include profile data
  const profile = getProfile().filter((p) => p.content.trim().length > 0)
  if (profile.length > 0) {
    parts.push('=== Profile ===')
    for (const p of profile) {
      parts.push(`[${p.section}]: ${p.content}`)
    }
  }

  // Include active instructions
  const instructions = getActiveInstructions()
  if (instructions.length > 0) {
    parts.push('=== Instructions ===')
    for (const i of instructions) {
      parts.push(`#${i.id}: ${i.content}`)
    }
  }

  // Search memories
  const results = await hybridSearch(input.query, input.limit)
  if (results.length > 0) {
    parts.push('=== Memories ===')
    for (const r of results) {
      parts.push(`#${r.id} [${r.category}] (${r.created_at}): ${r.content}`)
    }
  }

  if (parts.length === 0) return 'No memories found.'
  return parts.join('\n')
}

// --- forget ---
export const deleteMemorySchema = z.object({
  id: z.number().describe('The ID to delete'),
  type: z.enum(['memory', 'instruction']).default('memory').describe('What to delete'),
})

export async function deleteMemoryHandler(input: z.infer<typeof deleteMemorySchema>) {
  if (input.type === 'instruction') {
    const deleted = deleteInstruction(input.id)
    return deleted ? `Deleted instruction #${input.id}` : `Instruction #${input.id} not found`
  }
  const deleted = deleteMemoryById(input.id)
  return deleted ? `Deleted memory #${input.id}` : `Memory #${input.id} not found`
}
