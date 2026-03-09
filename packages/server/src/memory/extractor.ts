import { getProfile, updateProfileSection, type ProfileSection } from './profile.js'
import { addInstruction } from './instructions.js'
import { saveMemoryWithDedup } from './memories.js'
import { getSessionMessages, getOrCreateSession } from '../opencode/client.js'
import { waitForResponse } from '../opencode/wait-for-response.js'
import { logger } from '../lib/logger.js'

const EXTRACTION_PROMPT = `Analyze this conversation between a user and AI assistant.
Extract ONLY information worth remembering long-term:

1. profile_updates: Changes to user identity, tech stack, interests, communication style, or work patterns.
   Return as array of {section: "identity"|"technical"|"interests"|"communication"|"work_patterns", content: "text to append"}

2. new_instructions: Things the user wants the AI to always or never do.
   Return as array of strings.

3. new_memories: Facts, preferences, or observations worth remembering.
   Return as array of {content: string, category: "preference"|"fact"|"project"|"person"|"decision"}

Rules:
- Ignore transient queries and one-time requests
- Ignore things already covered by existing profile
- Only extract what has long-term value
- Be concise
- If nothing worth extracting, return empty arrays

Existing profile:
{PROFILE}

Return ONLY valid JSON: {"profile_updates": [], "new_instructions": [], "new_memories": []}
Do not wrap in markdown code fences.`

interface ExtractionResult {
  profile_updates: Array<{ section: ProfileSection; content: string }>
  new_instructions: string[]
  new_memories: Array<{ content: string; category: string }>
}

// Track which sessions we've already extracted from
const extractedSessions = new Set<string>()

// Sessions used for extraction itself (to prevent recursive extraction)
const extractionSessionPurpose = 'memory-extraction'

export function isExtractionSession(sessionId: string): boolean {
  return sessionId === extractionSessionId
}

let extractionSessionId: string | null = null

export async function extractFromSession(sessionId: string): Promise<void> {
  if (extractedSessions.has(sessionId)) return
  extractedSessions.add(sessionId)

  try {
    const messages = await getSessionMessages(sessionId)
    if (!messages || messages.length < 4) return // need at least 2 exchanges

    // Build conversation text from messages
    const conversationParts: string[] = []
    for (const msg of messages) {
      const info = msg.info || msg
      const role = info.role || 'unknown'
      const parts = msg.parts || []
      for (const part of parts) {
        if (part.type === 'text' && part.text) {
          conversationParts.push(`${role}: ${part.text.slice(0, 500)}`)
        }
      }
    }

    if (conversationParts.length < 4) return

    // Limit conversation size to avoid huge prompts
    const conversation = conversationParts.slice(-20).join('\n\n')

    // Build profile context
    const profile = getProfile()
    const profileText = profile.map(p => `${p.section}: ${p.content || '(empty)'}`).join('\n')

    const prompt = EXTRACTION_PROMPT.replace('{PROFILE}', profileText) + '\n\nConversation:\n' + conversation

    // Use a dedicated extraction session
    const exSessionId = await getOrCreateSession(extractionSessionPurpose)
    extractionSessionId = exSessionId
    const response = await waitForResponse(exSessionId, prompt, { timeoutMs: 30_000 })

    if (!response) {
      logger.warn({ sessionId }, 'No extraction response')
      return
    }

    // Parse JSON from response (handle markdown fences)
    let json = response.trim()
    if (json.startsWith('```')) {
      json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    let result: ExtractionResult
    try {
      result = JSON.parse(json)
    } catch {
      logger.warn({ sessionId, response: json.slice(0, 200) }, 'Failed to parse extraction JSON')
      return
    }

    // Apply profile updates
    for (const update of result.profile_updates || []) {
      const sections: ProfileSection[] = ['identity', 'technical', 'interests', 'communication', 'work_patterns']
      if (!sections.includes(update.section)) continue
      const existing = profile.find(p => p.section === update.section)
      const newContent = existing?.content
        ? existing.content + '\n' + update.content
        : update.content
      updateProfileSection(update.section, newContent)
      logger.info({ section: update.section }, 'Profile updated from extraction')
    }

    // Save new instructions
    for (const instruction of result.new_instructions || []) {
      addInstruction(instruction, 'extracted')
      logger.info({ instruction }, 'Instruction extracted')
    }

    // Save new memories (with dedup)
    for (const memory of result.new_memories || []) {
      await saveMemoryWithDedup(memory.content, memory.category, 'extracted')
      logger.info({ content: memory.content }, 'Memory extracted')
    }

    logger.info({
      sessionId,
      profiles: result.profile_updates?.length || 0,
      instructions: result.new_instructions?.length || 0,
      memories: result.new_memories?.length || 0,
    }, 'Post-conversation extraction complete')
  } catch (err) {
    logger.error({ err, sessionId }, 'Post-conversation extraction failed')
  }
}
