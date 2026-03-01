import { searchMemory } from '../bot/memory/index.js'

export interface AgentContext {
  memories: string[]
  skills: string[]
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
    skills: [],
    channelType,
    chatId,
  }
}

export function buildSystemPrompt(ctx: AgentContext): string {
  const parts: string[] = [
    `You are a personal AI assistant. You are responding via ${ctx.channelType} (chat: ${ctx.chatId}).`,
    'Be concise and helpful. Use your tools when appropriate.',
  ]

  if (ctx.memories.length > 0) {
    parts.push('\n## Relevant Memories\n' + ctx.memories.join('\n'))
  }

  if (ctx.skills.length > 0) {
    parts.push('\n## Active Skills\n' + ctx.skills.join('\n'))
  }

  return parts.join('\n')
}
