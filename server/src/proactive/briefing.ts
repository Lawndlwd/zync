import { getOrCreateSession, sendPromptAsync, getSessionMessages, isSessionIdle } from '../opencode/client.js'
import { getChannelManager } from '../channels/manager.js'
import type { ChannelType } from '../channels/types.js'

const DEFAULT_CHANNEL = (process.env.DEFAULT_CHANNEL || 'telegram') as ChannelType
const DEFAULT_CHAT_ID = process.env.DEFAULT_CHAT_ID || ''

async function getResponse(sessionId: string, msgCountBefore: number): Promise<string> {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1500))
    const idle = await isSessionIdle(sessionId)
    if (!idle) continue
    const msgs = await getSessionMessages(sessionId)
    if (msgs.length <= msgCountBefore) continue
    const newMsgs = msgs.slice(msgCountBefore)
    const last = [...newMsgs].reverse().find((m: any) => m.role === 'assistant' || m.info?.role === 'assistant')
    if (last?.parts) {
      const texts = last.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text)
      if (texts.length > 0 && texts.some((t: string) => t.length > 0)) {
        return texts.join('')
      }
    }
  }
  return 'Could not generate briefing.'
}

export async function sendMorningBriefing(): Promise<void> {
  if (!DEFAULT_CHAT_ID) return

  const sessionId = await getOrCreateSession('daily-briefing')
  const msgsBefore = await getSessionMessages(sessionId)

  const prompt = `Generate a morning briefing for today. Include:
- Summary of pending Jira issues (use your tools to check)
- Open to-do items
- Any scheduled events for today
- A motivational start to the day
Keep it concise but useful.`

  await sendPromptAsync(sessionId, prompt)
  const response = await getResponse(sessionId, msgsBefore.length)

  const manager = getChannelManager()
  await manager.send(DEFAULT_CHANNEL, DEFAULT_CHAT_ID, { text: `Morning Briefing\n\n${response}` })
}

export async function sendEveningRecap(): Promise<void> {
  if (!DEFAULT_CHAT_ID) return

  const sessionId = await getOrCreateSession('daily-recap')
  const msgsBefore = await getSessionMessages(sessionId)

  const prompt = `Generate an evening recap for today. Include:
- Tasks completed today
- Messages handled
- Pending items carrying over to tomorrow
- Any blockers that need attention
Keep it concise.`

  await sendPromptAsync(sessionId, prompt)
  const response = await getResponse(sessionId, msgsBefore.length)

  const manager = getChannelManager()
  await manager.send(DEFAULT_CHANNEL, DEFAULT_CHAT_ID, { text: `Evening Recap\n\n${response}` })
}
