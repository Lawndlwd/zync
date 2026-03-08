import { logger } from '../lib/logger.js'
import { getSecret } from '../secrets/index.js'
import { getPendingComments, getRules, updateCommentReply } from './db.js'
import { getOrCreateSession } from '../opencode/client.js'
import { waitForResponse } from '../opencode/wait-for-response.js'
import { loadPromptContent } from '../skills/prompts.js'

const DEFAULT_PROMPT = loadPromptContent('auto-reply')

function getAutoReplyConfig() {
  const enabled = getSecret('SOCIAL_AUTO_REPLY_ENABLED')
  const prompt = getSecret('SOCIAL_AUTO_REPLY_PROMPT')
  const requireApproval = getSecret('SOCIAL_AUTO_REPLY_REQUIRE_APPROVAL')
  return {
    enabled: enabled === 'true',
    prompt: prompt || DEFAULT_PROMPT,
    requireApproval: requireApproval !== 'false', // default true
  }
}

async function askLLM(prompt: string, timeoutMs = 30_000): Promise<string> {
  const sessionId = await getOrCreateSession('social')
  return waitForResponse(sessionId, prompt, { timeoutMs })
}

function matchRule(content: string, rules: Array<{ pattern: string; response_template: string; enabled: number | boolean }>): string | null {
  for (const rule of rules) {
    if (!rule.enabled) continue
    try {
      const regex = new RegExp(rule.pattern, 'i')
      if (regex.test(content)) {
        return rule.response_template
      }
    } catch {
      if (content.toLowerCase().includes(rule.pattern.toLowerCase())) {
        return rule.response_template
      }
    }
  }
  return null
}

export async function processNewComments(): Promise<{ autoReplied: number; drafted: number; flagged: number }> {
  const config = getAutoReplyConfig()
  if (!config.enabled) return { autoReplied: 0, drafted: 0, flagged: 0 }

  const pending = getPendingComments() as Array<{ id: number; platform: string; content: string; author: string; post_external_id: string }>
  if (pending.length === 0) return { autoReplied: 0, drafted: 0, flagged: 0 }

  let autoReplied = 0
  let drafted = 0
  let flagged = 0

  // Status to use: if approval required, draft instead of auto-reply
  const replyStatus = config.requireApproval ? 'draft_reply' : 'auto_replied'

  for (const comment of pending) {
    try {
      // 1. Check against reply rules
      const rules = getRules(comment.platform) as Array<{ pattern: string; response_template: string; enabled: number | boolean }>
      const ruleMatch = matchRule(comment.content, rules)

      if (ruleMatch) {
        let reply = ruleMatch
        if (reply.includes('{{ai}}')) {
          const aiPart = await askLLM(
            `${config.prompt}\n\nComment by @${comment.author}: "${comment.content}"\nTemplate hint: "${ruleMatch.replace('{{ai}}', '')}"\n\nReply:`
          )
          reply = ruleMatch.replace('{{ai}}', aiPart)
        }
        updateCommentReply(comment.id, replyStatus, reply)
        if (config.requireApproval) drafted++; else autoReplied++
        continue
      }

      // 2. Generate reply with LLM using custom prompt
      const reply = await askLLM(
        `${config.prompt}\n\nComment by @${comment.author}: "${comment.content}"\n\nReply:`
      )
      updateCommentReply(comment.id, replyStatus, reply)
      if (config.requireApproval) drafted++; else autoReplied++
    } catch (err) {
      logger.error({ err, commentId: comment.id }, 'Error processing comment')
      updateCommentReply(comment.id, 'flagged')
      flagged++
    }
  }

  logger.info({ autoReplied, drafted, flagged, total: pending.length }, 'Comments processed')
  return { autoReplied, drafted, flagged }
}
