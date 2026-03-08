import { readFileSync } from 'fs'
import { logger } from '../lib/logger.js'
import { getOrCreateSession } from '../opencode/client.js'
import { waitForResponse } from '../opencode/wait-for-response.js'
import { getInsights } from './db.js'
import { loadPromptContent, interpolate } from '../skills/prompts.js'

async function askLLM(prompt: string, timeoutMs = 90_000): Promise<string> {
  const sessionId = await getOrCreateSession('social')
  return waitForResponse(sessionId, prompt, { timeoutMs })
}

export interface MediaAnalysis {
  composition: string
  filterSuggestions: string[]
  captionIdeas: string[]
  hashtags: string[]
  mood: string
  keyMoments?: string[]
  trimSuggestions?: string
}

export async function analyzeImage(imagePath: string): Promise<MediaAnalysis> {
  const imageBuffer = readFileSync(imagePath)
  const base64 = imageBuffer.toString('base64')
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg'

  const prompt = interpolate(loadPromptContent('image-analysis'), {
    imageDataUri: `data:${mimeType};base64,${base64.slice(0, 100)}...`,
  })

  const response = await askLLM(prompt)

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0]) as MediaAnalysis
  } catch {
    logger.warn('Failed to parse image analysis JSON, returning defaults')
  }

  return {
    composition: 'Analysis unavailable',
    filterSuggestions: [],
    captionIdeas: ['Check out this post!'],
    hashtags: ['#social', '#content'],
    mood: 'neutral',
  }
}

export async function analyzeVideo(videoPath: string): Promise<MediaAnalysis> {
  // Without ffmpeg frame extraction, analyze based on metadata
  const prompt = loadPromptContent('video-analysis')

  const response = await askLLM(prompt)

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0]) as MediaAnalysis
  } catch {
    logger.warn('Failed to parse video analysis JSON')
  }

  return {
    composition: 'Keep videos short and engaging',
    filterSuggestions: [],
    captionIdeas: ['Check out this video!'],
    hashtags: ['#video', '#content', '#reels'],
    mood: 'dynamic',
    keyMoments: ['Hook viewers in first 3 seconds'],
    trimSuggestions: 'Keep under 60 seconds for maximum engagement',
  }
}

export async function suggestOptimalTime(platform: string): Promise<{ day: string; hour: number; reason: string }> {
  const heatmap = getInsights(platform, 90).postingHeatmap
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  if (heatmap.length === 0) {
    return { day: 'Tuesday', hour: 18, reason: 'Default recommendation — not enough data for personalized suggestion yet' }
  }

  // Find slot with highest average engagement
  const best = heatmap.reduce((a, b) => (Number(b.avg_engagement) > Number(a.avg_engagement) ? b : a))
  const dayIdx = Number(best.day_of_week)
  const hour = Number(best.hour)
  const dayName = days[dayIdx] || `Day ${dayIdx}`
  return {
    day: dayName,
    hour,
    reason: `Based on your posting history, ${dayName} at ${hour}:00 has the highest average engagement (${Number(best.avg_engagement).toFixed(1)})`,
  }
}

export async function generateCaptionForMedia(
  analysis: MediaAnalysis,
  style?: string,
): Promise<{ caption: string; hashtags: string[]; estimatedReach: string }> {
  const prompt = interpolate(loadPromptContent('caption-generator'), {
    mood: analysis.mood,
    composition: analysis.composition,
    styleLine: style ? `Style preference: ${style}` : 'Style: engaging, authentic, not too long',
  })

  const response = await askLLM(prompt)

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
  } catch {
    logger.warn('Failed to parse caption generation JSON')
  }

  return {
    caption: analysis.captionIdeas[0] || 'Check out this post!',
    hashtags: analysis.hashtags,
    estimatedReach: 'Medium',
  }
}

export async function generateFromBrief(opts: {
  brief: string
  tone: string
  platform: string
  language?: string
  existingCaption?: string
  target: 'caption' | 'first_comment'
}): Promise<{ text: string; hashtags: string[] }> {
  const toneMap: Record<string, string> = {
    funny: 'Humorous, witty, comedy style — make people laugh',
    confident: 'Bold, confident, assertive — power energy',
    casual: 'Casual, chill, conversational — like texting a friend',
    professional: 'Professional, polished, business-like',
    inspirational: 'Inspirational, motivational, uplifting',
    edgy: 'Edgy, provocative, attention-grabbing — slightly controversial',
    storytelling: 'Storytelling style — hook, narrative, resolution',
    trendy: 'Use current internet slang, memes, trending language',
  }

  const toneDesc = toneMap[opts.tone] || opts.tone
  const isFirstComment = opts.target === 'first_comment'

  const targetInstructions = isFirstComment
    ? `Write a FIRST COMMENT (posted immediately after the main post). Purpose: boost reach with hashtags.
- One punchy line that sparks engagement (a question, hot take, or relatable statement — NOT "ready to..." or generic CTAs)
- Then 15-20 hashtags: mix viral popular ones with specific niche ones relevant to the topic`
    : `Write a CAPTION that sounds like a real person wrote it, not an AI:
- ${opts.platform === 'x' ? 'Under 280 characters total' : 'Keep it tight — 1-3 sentences max, no filler'}
- Open with something that stops the scroll: a bold statement, a question, a story hook, or an unexpected angle
- NEVER end with generic phrases like "Ready to...", "Let's go!", "Drop a comment!", "Who else...?" — if the caption is good, people will engage without being told to
- The tone must feel authentic to the voice selected above
- Add 5-8 hashtags at the end (mix trending + niche)`

  const prompt = interpolate(loadPromptContent('social-ghostwriter'), {
    platform: opts.platform,
    brief: opts.brief,
    toneDesc,
    languageLine: opts.language ? `LANGUAGE: Write ENTIRELY in ${opts.language}. Hashtags can mix ${opts.language} and English.` : '',
    existingCaptionLine: opts.existingCaption && isFirstComment ? `MAIN CAPTION (already written): "${opts.existingCaption}"` : '',
    targetInstructions,
    target: isFirstComment ? 'first comment' : 'caption',
  })

  const response = await askLLM(prompt)

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
  } catch {
    logger.warn('Failed to parse generateFromBrief JSON')
  }

  return { text: opts.brief, hashtags: ['#content', '#trending'] }
}

export async function suggestHashtags(content: string): Promise<string[]> {
  const prompt = interpolate(loadPromptContent('hashtag-suggestions'), {
    content,
  })

  const response = await askLLM(prompt)

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
  } catch {
    logger.warn('Failed to parse hashtag suggestions')
  }

  return ['#content', '#social', '#instagram']
}

export interface TrendResult {
  trend_title: string
  description: string
  relevance: 'hot' | 'rising' | 'emerging'
  hashtags: string[]
  content_ideas: string[]
}

export async function searchTrends(topic: string, platform: string): Promise<TrendResult[]> {
  const platformHint = platform && platform !== 'all' ? ` specifically for ${platform}` : ' across social media platforms'
  const prompt = `You are a social media trend analyst. Suggest 6 trending topics related to "${topic}"${platformHint}.

You may check up to 3 websites for recent data, but do not browse more than that. Be quick and focused.
Do NOT use any skills, superpowers, or interactive tools. Do NOT invoke any skill tool or ask clarifying questions. Just answer directly with the JSON.

Return a JSON array of exactly 6 items. Each item must have:
- trend_title: catchy title for the trend
- description: 1-2 sentences explaining why it's trending and how to leverage it
- relevance: one of "hot", "rising", or "emerging"
- hashtags: array of 3-5 relevant hashtags (with # prefix)
- content_ideas: array of 2-3 specific post ideas a creator could make

Respond with ONLY the JSON array, no markdown fences or extra text.`

  const response = await askLLM(prompt, 60_000)

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as TrendResult[]
      return parsed.filter((t) => t.trend_title && t.hashtags && t.content_ideas)
    }
  } catch {
    logger.warn('Failed to parse trend search JSON')
  }

  return []
}
