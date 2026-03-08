import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { Response } from 'express'
import { logger } from '../lib/logger.js'
import { getOrCreateSession } from '../opencode/client.js'
import { streamOpenCode } from '../opencode/stream.js'
import { getWorkshopCards, createWorkshopCard, updateWorkshopCard, getWorkshopMessages, insertWorkshopMessage } from './db.js'
import { getConfig } from '../config/index.js'
import { loadPromptContent, interpolate } from '../skills/prompts.js'

function loadUserProfile(): string {
  const docsPath = getConfig('DOCUMENTS_PATH')
  if (!docsPath) return ''
  const mePath = join(docsPath, 'me.md')
  if (!existsSync(mePath)) return ''
  try {
    return readFileSync(mePath, 'utf-8')
  } catch {
    return ''
  }
}

/**
 * Build the initial system prompt that is sent ONCE when the board session starts.
 * This includes the full board context, instructions, and card list.
 * Subsequent messages in the same session are just the user's actual text.
 */
function buildSystemPrompt(boardId: number, boardName: string, platform: string): string {
  const cards = getWorkshopCards(boardId) as Array<{
    id: number; title: string; description: string; column_name: string; tags: string; notes: string
  }>

  const cardsSummary = cards.length > 0
    ? cards.map(c => `- [${c.column_name}] (id:${c.id}) "${c.title}" — ${c.description || '(no description)'}${c.notes ? ` | Notes: ${c.notes.slice(0, 200)}` : ''}`).join('\n')
    : '(No cards yet)'

  const userProfile = loadUserProfile()

  return interpolate(loadPromptContent('content-strategist'), {
    userProfile: userProfile ? `\n## About the User\n${userProfile}\n` : '',
    boardName,
    platform,
    cardsSummary,
    recentChat: '',
    userMessage: '[Session started — ready to help]',
  })
}

/**
 * Build a context-refresh snippet so the AI always has an up-to-date card list.
 * This is prepended to the user message so the AI can reference current card IDs.
 */
function buildContextRefresh(boardId: number): string {
  const cards = getWorkshopCards(boardId) as Array<{
    id: number; title: string; description: string; column_name: string; tags: string; notes: string
  }>
  if (cards.length === 0) return ''
  const cardsSummary = cards
    .map(c => `- [${c.column_name}] (id:${c.id}) "${c.title}" — ${c.description || '(no description)'}`)
    .join('\n')
  return `[Current board state]\n${cardsSummary}\n\n`
}

function parseAndCreateCards(boardId: number, fullText: string): Array<{ title: string; description: string; tags: string[] }> {
  const newCards: Array<{ title: string; description: string; tags: string[] }> = []
  const cardsMatch = fullText.match(/```cards\s*\n([\s\S]*?)\n```/)
  if (cardsMatch) {
    try {
      const parsed = JSON.parse(cardsMatch[1])
      if (Array.isArray(parsed)) {
        for (const card of parsed) {
          if (card.title) {
            newCards.push({
              title: card.title,
              description: card.description || '',
              tags: Array.isArray(card.tags) ? card.tags : [],
            })
            createWorkshopCard({
              board_id: boardId,
              title: card.title,
              description: card.description || '',
              column_name: 'ideas',
              tags: JSON.stringify(card.tags || []),
            })
          }
        }
      }
    } catch {
      logger.warn('Failed to parse card suggestions from AI response')
    }
  }
  return newCards
}

function parseAndUpdateCard(fullText: string): { id: number; description?: string; notes?: string; tags?: string[] } | null {
  const match = fullText.match(/```card-update\s*\n([\s\S]*?)\n```/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1])
    if (typeof parsed.id === 'number') {
      return {
        id: parsed.id,
        description: typeof parsed.description === 'string' ? parsed.description : undefined,
        notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
        tags: Array.isArray(parsed.tags) ? parsed.tags : undefined,
      }
    }
  } catch {
    logger.warn('Failed to parse card-update block from AI response')
  }
  return null
}

export async function workshopChatStream(
  boardId: number,
  userMessage: string,
  boardName: string,
  platform: string,
  res: Response
): Promise<void> {
  insertWorkshopMessage(boardId, 'user', userMessage)

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  // One persistent session per board — stays alive across messages
  // Use the 'general' agent to disable coding superpowers/tools
  const sessionKey = `social-board-${boardId}`
  const sessionId = await getOrCreateSession(sessionKey, 'general')

  // Check if this is a brand-new session (no messages yet in OpenCode)
  // If so, send the full system context first so subsequent messages are clean
  const existingHistory = getWorkshopMessages(boardId, 1)
  const isFirstMessage = existingHistory.length <= 1 // only the message we just inserted

  let promptToSend: string
  if (isFirstMessage) {
    // First ever message: send full system prompt + the user message inline
    const systemCtx = buildSystemPrompt(boardId, boardName, platform)
    promptToSend = `${systemCtx}\n\n---\nUser: ${userMessage}`
  } else {
    // Continuing conversation: send a lightweight context refresh + user message only
    // This lets OpenCode maintain its own conversational memory
    const ctxRefresh = buildContextRefresh(boardId)
    promptToSend = `${ctxRefresh}User: ${userMessage}`
  }

  const cleanup = await streamOpenCode(sessionId, promptToSend, {
    onToken: (text) => {
      res.write(`data: ${JSON.stringify({ type: 'token', content: text })}\n\n`)
    },
    onDone: (fullText) => {
      const newCards = parseAndCreateCards(boardId, fullText)
      const cardUpdate = parseAndUpdateCard(fullText)

      // Strip all structured blocks from the visible reply
      const cleanReply = fullText
        .replace(/```cards\s*\n[\s\S]*?\n```/, '')
        .replace(/```card-update\s*\n[\s\S]*?\n```/, '')
        .trim()

      if (cleanReply) insertWorkshopMessage(boardId, 'assistant', cleanReply)

      if (newCards.length > 0) {
        res.write(`data: ${JSON.stringify({ type: 'cards', cards: newCards })}\n\n`)
      }

      if (cardUpdate) {
        try {
          updateWorkshopCard(cardUpdate.id, {
            description: cardUpdate.description,
            notes: cardUpdate.notes,
            tags: cardUpdate.tags ? JSON.stringify(cardUpdate.tags) : undefined,
          })
          res.write(`data: ${JSON.stringify({ type: 'card-updated', id: cardUpdate.id })}\n\n`)
          logger.info({ boardId, cardId: cardUpdate.id }, 'Card updated via AI discussion')
        } catch (err) {
          logger.warn({ err, cardId: cardUpdate.id }, 'Failed to update card from AI discussion')
        }
      }

      res.write('data: [DONE]\n\n')
      res.end()
      logger.info({ boardId, sessionKey, newCardsCount: newCards.length }, 'Workshop chat completed')
    },
    onError: (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message })
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      }
    },
  }, { timeoutMs: 90_000 })

  res.on('close', cleanup)
}
