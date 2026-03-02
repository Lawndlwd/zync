import { searchMemory } from '../bot/memory/index.js'
import { matchSkills } from '../skills/loader.js'

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

  const matched = matchSkills(text)

  return {
    memories,
    skills: matched.map(s => `### ${s.name}\n${s.content}`),
    channelType,
    chatId,
  }
}

export function buildSystemPrompt(ctx: AgentContext): string {
  const parts: string[] = [
    `You are a personal AI assistant. You are responding via ${ctx.channelType} (chat: ${ctx.chatId}).`,
    'Be concise and helpful. Use your tools when appropriate.',
    `
## Live Canvas

You have a Live Canvas at /canvas. Use \`zync_render_canvas\` to push visual content.

**ONLY use Canvas when the user explicitly asks** — words like: chart, graph, visualize, dashboard, render, canvas, table, plot.
Do NOT push to Canvas for regular questions or summaries.

**A base dark design system is pre-injected.** You only provide the html (and optional css/js). Available classes:
- Layout: \`.card\`, \`.card-header\`, \`.grid\`, \`.grid-2\`/\`.grid-3\`/\`.grid-4\`, \`.flex\`, \`.flex-col\`, \`.gap-1\` to \`.gap-4\`, \`.items-center\`, \`.justify-between\`
- Data: \`table\`/\`thead\`/\`tbody\` (styled automatically), \`.stat\`+\`.stat-value\`+\`.stat-label\`
- Tags: \`.badge\`, \`.badge-blue\`, \`.badge-green\`, \`.badge-yellow\`, \`.badge-red\`, \`.badge-purple\`
- Other: \`.progress\`+\`.progress-bar\`, \`.chart-container\`, \`.animate-in\`
- Typography: h1/h2/h3/p/small/code all pre-styled

**Rules:**
- Always provide a short \`title\` (e.g. "Email Overview", "Sprint Burndown") — it appears in the history dropdown
- Write semantic HTML using the classes above — do NOT write custom colors/backgrounds unless needed
- For charts: use Chart.js via \`<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>\`
- After rendering, reply: "Pushed to Canvas"
- Use \`zync_clear_canvas\` to clear`,
  ]

  if (ctx.memories.length > 0) {
    parts.push('\n## Relevant Memories\n' + ctx.memories.join('\n'))
  }

  if (ctx.skills.length > 0) {
    parts.push('\n## Active Skills\n' + ctx.skills.join('\n'))
  }

  return parts.join('\n')
}
