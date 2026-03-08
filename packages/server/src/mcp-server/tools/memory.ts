import { z } from 'zod'
import { saveMemory, searchMemory, deleteMemory } from '../../bot/memory/index.js'

export const saveMemorySchema = z.object({
  content: z.string().describe('The information to remember'),
  category: z
    .string()
    .default('general')
    .describe('Memory category (preference, fact, project, person, decision)'),
})

export async function saveMemoryHandler(input: z.infer<typeof saveMemorySchema>) {
  const { id } = saveMemory(input.content, input.category)
  return `Saved memory #${id} in category '${input.category}'`
}

export const searchMemorySchema = z.object({
  query: z.string().describe('Search query'),
  limit: z.number().default(5).describe('Max results to return (default 5)'),
})

export async function searchMemoryHandler(input: z.infer<typeof searchMemorySchema>) {
  const results = searchMemory(input.query, input.limit)
  if (results.length === 0) return 'No memories found.'
  return results
    .map((r) => `#${r.id} [${r.category}] (${r.created_at}): ${r.content}`)
    .join('\n')
}

export const deleteMemorySchema = z.object({
  id: z.number().describe('The memory ID to delete'),
})

export async function deleteMemoryHandler(input: z.infer<typeof deleteMemorySchema>) {
  const deleted = deleteMemory(input.id)
  return deleted ? `Deleted memory #${input.id}` : `Memory #${input.id} not found`
}
