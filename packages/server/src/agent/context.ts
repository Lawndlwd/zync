import { hybridSearch } from '../memory/search.js'
import { buildProfileBlock } from '../memory/profile.js'
import { buildInstructionsBlock } from '../memory/instructions.js'
import { loadPromptContent, interpolate } from '../skills/prompts.js'

export interface AgentContext {
  profileBlock: string
  instructionsBlock: string
  memories: string[]
  channelType: string
  chatId: string
}

export async function assembleContext(text: string, channelType: string, chatId: string): Promise<AgentContext> {
  let memories: string[] = []
  try {
    const results = await hybridSearch(text, 5)
    memories = results.map((m) => `[${m.category}] ${m.content}`)
  } catch {
    // FTS match errors on short/special queries are fine
  }

  return {
    profileBlock: buildProfileBlock(),
    instructionsBlock: buildInstructionsBlock(),
    memories,
    channelType,
    chatId,
  }
}

export function buildSystemPrompt(ctx: AgentContext): string {
  const parts: string[] = [
    interpolate(loadPromptContent('assistant-system'), {
      channelType: ctx.channelType,
      chatId: ctx.chatId,
    }),
  ]

  if (ctx.profileBlock) {
    parts.push('\n' + ctx.profileBlock)
  }

  if (ctx.instructionsBlock) {
    parts.push('\n' + ctx.instructionsBlock)
  }

  if (ctx.memories.length > 0) {
    parts.push('\n## Relevant Memories\n' + ctx.memories.join('\n'))
  }

  return parts.join('\n')
}
