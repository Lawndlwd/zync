import { useState } from 'react'
import type { ContentIdea, SocialPlatform } from '@/types/social'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const statusColors: Record<string, string> = {
  idea: 'text-amber-400 bg-amber-500/10',
  drafted: 'text-blue-400 bg-blue-500/10',
  used: 'text-emerald-400 bg-emerald-500/10',
}

interface SocialIdeasProps {
  ideas: ContentIdea[]
  isLoading: boolean
  onGenerate: (platform: SocialPlatform, count: number, context?: string) => void
  onDraft: (id: number) => void
  isGenerating: boolean
}

export function SocialIdeas({ ideas, isLoading, onGenerate, onDraft, isGenerating }: SocialIdeasProps) {
  const [platform, setPlatform] = useState<SocialPlatform>('instagram')
  const [context, setContext] = useState('')
  const [count, setCount] = useState(5)

  return (
    <div>
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 mb-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Generate Content Ideas</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200"
            >
              <option value="instagram">Instagram</option>
              <option value="x">X</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Count</label>
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-16 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-zinc-500 mb-1">Topic/Context (optional)</label>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. product launch, behind the scenes"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
          <Button
            size="sm"
            onClick={() => onGenerate(platform, count, context || undefined)}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Sparkles size={14} className="mr-1.5" />}
            Generate
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">Loading ideas...</div>
      ) : ideas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <Sparkles size={24} className="mb-2" />
          <p className="text-sm">No ideas yet</p>
          <p className="text-xs mt-1">Generate some content ideas above</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {ideas.map((idea) => (
            <div
              key={idea.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-start justify-between gap-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-zinc-500 capitalize">{idea.platform}</span>
                  <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', statusColors[idea.status])}>
                    {idea.status}
                  </span>
                </div>
                <p className="text-sm text-zinc-300">{idea.idea_text}</p>
                <p className="mt-1 text-xs text-zinc-600">{new Date(idea.generated_at).toLocaleString()}</p>
              </div>
              {idea.status === 'idea' && (
                <Button variant="ghost" size="sm" onClick={() => onDraft(idea.id)}>
                  <FileText size={14} className="mr-1" />
                  Draft
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
