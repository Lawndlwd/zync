import { z } from 'zod'
import { webSearch } from '../../agent/tools/web-search.js'

export const webSearchSchema = z.object({
  query: z.string().describe('Search query'),
  max_results: z.number().optional().describe('Maximum results to return (default 5)'),
})

export async function webSearchTool(args: z.infer<typeof webSearchSchema>): Promise<string> {
  const results = await webSearch(args.query, args.max_results)
  if (results.length === 0) return 'No results found.'
  return results.map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`).join('\n\n')
}
