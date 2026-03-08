import { searchMemory } from '../bot/memory/index.js'
import { loadPromptContent, interpolate } from '../skills/prompts.js'

export interface AgentContext {
  memories: string[]
  channelType: string
  chatId: string
}

export function assembleContext(text: string, channelType: string, chatId: string): AgentContext {
  let memories: string[] = []
  try {
    const results = searchMemory(text, 5)
    memories = results.map((m) => `[${m.category}] ${m.content}`)
  } catch {
    // FTS match errors on short/special queries are fine
  }

  return {
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

  if (ctx.memories.length > 0) {
    parts.push('\n## Relevant Memories\n' + ctx.memories.join('\n'))
  }

  return parts.join('\n')
}
