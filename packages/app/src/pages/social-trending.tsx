import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, Bookmark, BookmarkCheck, Flame, TrendingUp, Sprout, Copy, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TrendResult, SavedTrend } from '@zync/shared/types'
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
      if (trends.length === 0) toast('No trends found for that topic')
    } catch (err: any) {
      toast.error(err.message || 'Search failed')
    }
    setSearching(false)
  }

  const isBookmarked = (title: string) => bookmarks.some((b) => b.trend_title === title)

  const handleBookmark = async (trend: TrendResult) => {
    const existing = bookmarks.find((b) => b.trend_title === trend.trend_title)
    if (existing) {
      try {
        await socialService.removeBookmark(existing.id)
        setBookmarks((prev) => prev.filter((b) => b.id !== existing.id))
      } catch { toast.error('Failed to remove bookmark') }
    } else {
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
          <p className="text-sm text-zinc-400">Researching trends for &quot;{topic}&quot;...</p>
          <p className="text-xs text-zinc-600 mt-1">This may take a moment</p>
        </div>
      )}

      {/* Empty state */}
      {!searching && displayTrends.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <TrendingUp size={32} className="mb-3 text-indigo-400/30" />
          <p className="text-sm mb-1">{showBookmarks ? 'No saved trends yet' : 'Search for trending topics'}</p>
          <p className="text-xs">{showBookmarks ? 'Bookmark trends from search results' : "Enter a topic or niche to discover what's trending"}</p>
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
