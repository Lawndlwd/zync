# Social Trending Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an AI-powered trending research tab where users search a topic/niche and get back trending topics, hashtags, and content ideas they can bookmark or send to Create.

**Architecture:** New `social_saved_trends` SQLite table for bookmarks. LLM endpoint calls `askLLM()` (existing pattern from `ai-analyzer.ts`) with a structured prompt that returns JSON array of trends. Frontend page with search bar, result cards, and bookmark toggle.

**Tech Stack:** React, TypeScript, Tailwind CSS, SQLite (better-sqlite3), LLM via opencode session, react-hot-toast

---

### Task 1: Add social_saved_trends table and DB helpers

**Files:**
- Modify: `server/src/social/db.ts`

Add to the CREATE TABLE block (before the closing backtick of `db.exec`):

```sql
CREATE TABLE IF NOT EXISTS social_saved_trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'all',
  trend_title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  hashtags TEXT NOT NULL DEFAULT '[]',
  content_ideas TEXT NOT NULL DEFAULT '[]',
  relevance TEXT NOT NULL DEFAULT 'trending',
  created_at TEXT DEFAULT (datetime('now'))
);
```

Add helper functions after the workshop helpers section:

```typescript
// --- Trend bookmark helpers ---

export function getSavedTrends() {
  return getSocialDb().prepare('SELECT * FROM social_saved_trends ORDER BY created_at DESC').all()
}

export function saveTrend(trend: {
  topic: string; platform: string; trend_title: string; description: string;
  hashtags: string; content_ideas: string; relevance: string;
}) {
  const db = getSocialDb()
  const result = db.prepare(`
    INSERT INTO social_saved_trends (topic, platform, trend_title, description, hashtags, content_ideas, relevance)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(trend.topic, trend.platform, trend.trend_title, trend.description, trend.hashtags, trend.content_ideas, trend.relevance)
  return result.lastInsertRowid
}

export function deleteSavedTrend(id: number) {
  getSocialDb().prepare('DELETE FROM social_saved_trends WHERE id = ?').run(id)
}
```

**Commit:** `feat(social): add social_saved_trends table and bookmark helpers`

---

### Task 2: Add LLM trend search function

**Files:**
- Modify: `server/src/social/ai-analyzer.ts`

Add at the bottom of the file:

```typescript
export interface TrendResult {
  trend_title: string
  description: string
  relevance: 'hot' | 'rising' | 'emerging'
  hashtags: string[]
  content_ideas: string[]
}

export async function searchTrends(topic: string, platform: string): Promise<TrendResult[]> {
  const platformHint = platform && platform !== 'all' ? ` specifically for ${platform}` : ' across social media platforms'
  const prompt = `You are a social media trend analyst. Research current trending topics related to "${topic}"${platformHint}.

Return a JSON array of 5-8 trending topics. Each item must have:
- trend_title: catchy title for the trend
- description: 1-2 sentences explaining why it's trending and how to leverage it
- relevance: one of "hot", "rising", or "emerging"
- hashtags: array of 3-5 relevant hashtags (with # prefix)
- content_ideas: array of 2-3 specific post ideas a creator could make

Respond with ONLY the JSON array, no markdown fences or extra text.`

  const response = await askLLM(prompt, 120_000)

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
```

**Commit:** `feat(social): add LLM-powered trend search function`

---

### Task 3: Add API routes for trends

**Files:**
- Modify: `server/src/routes/social.ts`

Add imports at top — add `getSavedTrends`, `saveTrend`, `deleteSavedTrend` to the db.js import, and add `searchTrends` to the ai-analyzer.js import.

Add routes before the workshop routes section:

```typescript
// --- Trend routes ---

// POST /api/social/trends/search — AI trend search
socialRouter.post('/trends/search', async (req, res) => {
  try {
    const { topic, platform } = req.body
    if (!topic) return res.status(400).json({ error: 'topic is required' })
    const trends = await searchTrends(topic, platform || 'all')
    res.json({ trends })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/social/trends/bookmarks — list bookmarked trends
socialRouter.get('/trends/bookmarks', (_req, res) => {
  try {
    const trends = getSavedTrends()
    res.json({ trends })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/social/trends/bookmark — save a trend
socialRouter.post('/trends/bookmark', (req, res) => {
  try {
    const { topic, platform, trend_title, description, hashtags, content_ideas, relevance } = req.body
    if (!trend_title) return res.status(400).json({ error: 'trend_title is required' })
    const id = saveTrend({
      topic: topic || '',
      platform: platform || 'all',
      trend_title,
      description: description || '',
      hashtags: JSON.stringify(hashtags || []),
      content_ideas: JSON.stringify(content_ideas || []),
      relevance: relevance || 'trending',
    })
    res.json({ id })
  } catch (err) {
    errorResponse(res, err)
  }
})

// DELETE /api/social/trends/:id — remove bookmark
socialRouter.delete('/trends/:id', (req, res) => {
  try {
    deleteSavedTrend(Number(req.params.id))
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})
```

**Commit:** `feat(social): add trend search and bookmark API routes`

---

### Task 4: Add frontend types and service functions

**Files:**
- Modify: `src/types/social.ts`
- Modify: `src/services/social.ts`

Add to `src/types/social.ts` at the bottom:

```typescript
// --- Trending types ---

export interface TrendResult {
  trend_title: string
  description: string
  relevance: 'hot' | 'rising' | 'emerging'
  hashtags: string[]
  content_ideas: string[]
}

export interface SavedTrend {
  id: number
  topic: string
  platform: string
  trend_title: string
  description: string
  hashtags: string // JSON string
  content_ideas: string // JSON string
  relevance: string
  created_at: string
}
```

Add to `src/services/social.ts` at the bottom (before the workshop section):

```typescript
// --- Trends ---

export async function searchTrends(topic: string, platform?: string): Promise<TrendResult[]> {
  const data = await fetchJSON<{ trends: TrendResult[] }>(`${API_BASE}/trends/search`, {
    method: 'POST',
    body: JSON.stringify({ topic, platform }),
  })
  return data.trends
}

export async function getBookmarkedTrends(): Promise<SavedTrend[]> {
  const data = await fetchJSON<{ trends: SavedTrend[] }>(`${API_BASE}/trends/bookmarks`)
  return data.trends
}

export async function bookmarkTrend(trend: {
  topic: string; platform: string; trend_title: string; description: string;
  hashtags: string[]; content_ideas: string[]; relevance: string;
}): Promise<{ id: number }> {
  return fetchJSON(`${API_BASE}/trends/bookmark`, {
    method: 'POST',
    body: JSON.stringify(trend),
  })
}

export async function removeBookmark(id: number): Promise<void> {
  await fetchJSON(`${API_BASE}/trends/${id}`, { method: 'DELETE' })
}
```

Add the import for `TrendResult` and `SavedTrend` to the imports line at the top of `src/services/social.ts`.

**Commit:** `feat(social): add trend types and service functions`

---

### Task 5: Create Trending page component

**Files:**
- Create: `src/pages/social-trending.tsx`

```tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, Bookmark, BookmarkCheck, Flame, TrendingUp, Sprout, Copy, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TrendResult, SavedTrend, SocialPlatform } from '@/types/social'
import * as socialService from '@/services/social'
import toast from 'react-hot-toast'

const platformOptions = [
  { value: 'all', label: 'All Platforms' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X / Twitter' },
  { value: 'youtube', label: 'YouTube' },
]

const relevanceConfig: Record<string, { icon: typeof Flame; color: string; bg: string }> = {
  hot: { icon: Flame, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
  rising: { icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  emerging: { icon: Sprout, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
}

export function SocialTrending() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState('all')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<TrendResult[]>([])
  const [bookmarks, setBookmarks] = useState<SavedTrend[]>([])
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  // Load bookmarks on mount
  useEffect(() => {
    socialService.getBookmarkedTrends().then(setBookmarks).catch(() => {})
  }, [])

  const handleSearch = async () => {
    if (!topic.trim()) return
    setSearching(true)
    setShowBookmarks(false)
    try {
      const trends = await socialService.searchTrends(topic.trim(), platform)
      setResults(trends)
      if (trends.length === 0) toast('No trends found for that topic', { icon: '🔍' })
    } catch (err: any) {
      toast.error(err.message || 'Search failed')
    }
    setSearching(false)
  }

  const isBookmarked = (title: string) => bookmarks.some((b) => b.trend_title === title)

  const handleBookmark = async (trend: TrendResult) => {
    const existing = bookmarks.find((b) => b.trend_title === trend.trend_title)
    if (existing) {
      // Remove bookmark
      try {
        await socialService.removeBookmark(existing.id)
        setBookmarks((prev) => prev.filter((b) => b.id !== existing.id))
      } catch { toast.error('Failed to remove bookmark') }
    } else {
      // Add bookmark
      try {
        const { id } = await socialService.bookmarkTrend({
          topic, platform, trend_title: trend.trend_title, description: trend.description,
          hashtags: trend.hashtags, content_ideas: trend.content_ideas, relevance: trend.relevance,
        })
        setBookmarks((prev) => [...prev, {
          id, topic, platform, trend_title: trend.trend_title, description: trend.description,
          hashtags: JSON.stringify(trend.hashtags), content_ideas: JSON.stringify(trend.content_ideas),
          relevance: trend.relevance, created_at: new Date().toISOString(),
        }])
      } catch { toast.error('Failed to bookmark') }
    }
  }

  const handleCreatePost = (trend: TrendResult, ideaIdx: number) => {
    const idea = trend.content_ideas[ideaIdx]
    const hashtags = trend.hashtags.join(' ')
    const content = `${idea}\n\n${hashtags}`
    const encoded = btoa(encodeURIComponent(content))
    navigate(`/social/create?trend=${encoded}`)
  }

  const copyHashtags = (hashtags: string[], idx: number) => {
    navigator.clipboard.writeText(hashtags.join(' '))
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  // Display either search results or bookmarks
  const displayTrends: Array<TrendResult & { savedId?: number }> = showBookmarks
    ? bookmarks.map((b) => ({
        trend_title: b.trend_title,
        description: b.description,
        relevance: b.relevance as TrendResult['relevance'],
        hashtags: JSON.parse(b.hashtags),
        content_ideas: JSON.parse(b.content_ideas),
        savedId: b.id,
      }))
    : results

  return (
    <div>
      {/* Search bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
            placeholder="Search for trends... e.g. 'fitness', 'AI tools', 'sustainable fashion'"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-10 pr-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/30 focus:outline-none"
          />
        </div>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="bg-zinc-900 border border-white/[0.08] rounded-lg px-2.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500/30"
        >
          {platformOptions.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <Button onClick={handleSearch} disabled={searching || !topic.trim()}>
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          <span className="ml-1.5">Search</span>
        </Button>
      </div>

      {/* Bookmarks toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowBookmarks(false)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            !showBookmarks ? 'bg-white/[0.1] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Search Results {results.length > 0 && `(${results.length})`}
        </button>
        <button
          onClick={() => setShowBookmarks(true)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            showBookmarks ? 'bg-white/[0.1] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Bookmark size={14} /> Saved {bookmarks.length > 0 && `(${bookmarks.length})`}
        </button>
      </div>

      {/* Loading */}
      {searching && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-indigo-400 mb-3" />
          <p className="text-sm text-zinc-400">Researching trends for "{topic}"...</p>
          <p className="text-xs text-zinc-600 mt-1">This may take a moment</p>
        </div>
      )}

      {/* Empty state */}
      {!searching && displayTrends.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <TrendingUp size={32} className="mb-3 text-indigo-400/30" />
          <p className="text-sm mb-1">{showBookmarks ? 'No saved trends yet' : 'Search for trending topics'}</p>
          <p className="text-xs">{showBookmarks ? 'Bookmark trends from search results' : 'Enter a topic or niche to discover what\'s trending'}</p>
        </div>
      )}

      {/* Results */}
      {!searching && displayTrends.length > 0 && (
        <div className="space-y-3">
          {displayTrends.map((trend, idx) => {
            const rel = relevanceConfig[trend.relevance] || relevanceConfig.emerging
            const RelIcon = rel.icon
            const saved = isBookmarked(trend.trend_title)
            return (
              <div key={idx} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-100">{trend.trend_title}</h3>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${rel.bg} ${rel.color}`}>
                      <RelIcon size={10} />{trend.relevance}
                    </span>
                  </div>
                  <button
                    onClick={() => handleBookmark(trend)}
                    className={`p-1.5 rounded-lg transition-colors ${saved ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'}`}
                  >
                    {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                  </button>
                </div>

                <p className="text-xs text-zinc-400 mb-3">{trend.description}</p>

                {/* Hashtags */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  {trend.hashtags.map((tag, i) => (
                    <span key={i} className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                      {tag}
                    </span>
                  ))}
                  <button
                    onClick={() => copyHashtags(trend.hashtags, idx)}
                    className="rounded-full bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
                  >
                    {copiedIdx === idx ? <><Check size={8} />Copied</> : <><Copy size={8} />Copy all</>}
                  </button>
                </div>

                {/* Content ideas */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Content Ideas</p>
                  {trend.content_ideas.map((idea, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                      <p className="text-xs text-zinc-300 flex-1">{idea}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCreatePost(trend, i)}
                        className="flex-shrink-0 text-xs"
                      >
                        <ExternalLink size={12} className="mr-1" />Create Post
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

**Commit:** `feat(social): create trending page with search, cards, and bookmarks`

---

### Task 6: Add Trending tab to social layout and routing

**Files:**
- Modify: `src/components/social/social-layout.tsx` — add Trending tab
- Modify: `src/App.tsx` — add route

In `src/components/social/social-layout.tsx`, add to the `tabs` array after Dashboard:
```typescript
{ to: '/social/trending', label: 'Trending', icon: TrendingUp },
```
Add `TrendingUp` to the lucide-react import.

In `src/App.tsx`, add lazy import:
```typescript
const SocialTrending = lazy(() => import('@/pages/social-trending').then(m => ({ default: m.SocialTrending })))
```

Add route inside the `<Route path="/social" ...>` block, after dashboard:
```tsx
<Route path="trending" element={<SocialTrending />} />
```

**Commit:** `feat(social): add trending tab to layout and routing`

---

### Task 7: Wire Create page to accept trend query param

**Files:**
- Modify: `src/pages/social-create.tsx`

The page already imports `useSearchParams` and reads query params. Add this to the existing `useEffect` that handles initial state (or add a new small `useEffect`):

```typescript
// Pre-fill from trend
useEffect(() => {
  const trendParam = searchParams.get('trend')
  if (trendParam && !id) {
    try {
      const decoded = decodeURIComponent(atob(trendParam))
      setContent(decoded)
    } catch { /* ignore malformed */ }
  }
}, [searchParams, id])
```

This should go after the existing `useEffect` blocks (around line 125), before the `togglePlatform` function.

**Commit:** `feat(social): accept trend query param in create page`

---

### Task 8: Verify and cleanup

Run `npx tsc --noEmit` from project root. Fix any type errors.

Verify the trending tab appears in the social layout navigation.

**Commit:** `fix(social): resolve any type errors in trending feature` (only if needed)
