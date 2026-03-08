import { logger } from '../lib/logger.js'
import { getPosts, insertIdea, getIdeas, updateIdeaStatus } from './db.js'
import { getOrCreateSession } from '../opencode/client.js'
import { waitForResponse } from '../opencode/wait-for-response.js'
import { loadPromptContent, interpolate } from '../skills/prompts.js'

async function askLLM(prompt: string, timeoutMs = 60_000): Promise<string> {
  const sessionId = await getOrCreateSession('social')
  return waitForResponse(sessionId, prompt, { timeoutMs })
}

export async function generateContentIdeas(
  platform: string,
  count = 5,
  context?: string
): Promise<Array<{ id: number | bigint; idea_text: string }>> {
  // Get recent posts to avoid repetition
  const recentPosts = getPosts({ platform, limit: 10 }) as Array<{ content: string }>
  const recentContent = recentPosts.map((p) => p.content).filter(Boolean).slice(0, 5)

  const platformTips: Record<string, string> = {
    instagram: 'Visual-first content. Use carousel, reels, stories. Engagement-driven captions.',
    x: 'Short-form. Threads for deep topics. Timely/trending hooks. Under 280 chars per tweet.',
    youtube: 'Video concepts with compelling titles. Think thumbnails, hooks in first 5 seconds.',
  }

  const prompt = interpolate(loadPromptContent('content-ideas'), {
    count: String(count),
    platform,
    platformTips: platformTips[platform] || '',
    recentPosts: recentContent.length > 0 ? `Recent posts (avoid repetition):\n${recentContent.map((c) => `- ${c.slice(0, 100)}`).join('\n')}` : '',
    context: context ? `Additional context/topic: ${context}` : '',
  })

  const response = await askLLM(prompt)

  // Parse JSON from response
  let ideas: string[]
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    ideas = jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch {
    // Fallback: split by newlines
    ideas = response.split('\n').filter((l) => l.trim().length > 10).slice(0, count)
  }

  const results: Array<{ id: number | bigint; idea_text: string }> = []
  for (const idea of ideas) {
    const id = insertIdea(platform, idea)
    results.push({ id, idea_text: idea })
  }

  logger.info({ platform, count: results.length }, 'Content ideas generated')
  return results
}

export async function draftFromIdea(ideaId: number): Promise<string> {
  const ideas = getIdeas() as Array<{ id: number; platform: string; idea_text: string; status: string }>
  const idea = ideas.find((i) => i.id === ideaId)
  if (!idea) throw new Error(`Idea ${ideaId} not found`)

  const platformFormats: Record<string, string> = {
    instagram: 'Write an Instagram caption. Include a hook, body, CTA, and suggest 5-10 relevant hashtags. Keep it engaging and authentic.',
    x: 'Write a tweet (under 280 chars). Make it punchy, thought-provoking, or valuable. No hashtag spam.',
    youtube: 'Write a YouTube video title and description. Title should be click-worthy but not clickbait. Description should have key points and timestamps outline.',
  }

  const prompt = interpolate(loadPromptContent('content-draft'), {
    platform: idea.platform,
    ideaText: idea.idea_text,
    platformFormat: platformFormats[idea.platform] || 'Write a social media post.',
  })

  const draft = await askLLM(prompt)

  updateIdeaStatus(ideaId, 'drafted')
  logger.info({ ideaId, platform: idea.platform }, 'Idea drafted')
  return draft
}
