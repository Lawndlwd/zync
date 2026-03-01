import type { GitLabMergeRequest } from '@/types/gitlab'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { relativeTime } from '@/lib/utils'
import { ExternalLink, GitMerge, MessageSquare, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const stateVariant = (state: string, draft: boolean) => {
  if (draft) return 'default' as const
  switch (state) {
    case 'merged':
      return 'primary' as const
    case 'closed':
      return 'danger' as const
    default:
      return 'success' as const
  }
}

interface MRCardProps {
  mr: GitLabMergeRequest
  onSelect: (mr: GitLabMergeRequest) => void
}

export function MRCard({ mr, onSelect }: MRCardProps) {
  return (
    <Card
      className="cursor-pointer p-5 transition-colors hover:border-zinc-700"
      onClick={() => onSelect(mr)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <span className="text-sm font-mono text-indigo-400">!{mr.iid}</span>
            <Badge variant={stateVariant(mr.state, mr.draft)}>
              {mr.draft ? 'Draft' : mr.state}
            </Badge>
            {mr.has_conflicts && (
              <Badge variant="warning">
                <AlertTriangle size={14} className="mr-0.5" />
                Conflicts
              </Badge>
            )}
          </div>
          <p className="text-base font-medium text-zinc-200 truncate">{mr.title}</p>
          <div className="mt-2 flex items-center gap-3 text-sm text-zinc-500 flex-wrap">
            {mr.reviewers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-zinc-600">Reviewers:</span>
                <div className="flex -space-x-1.5">
                  {mr.reviewers.slice(0, 4).map((r) =>
                    r.avatar_url ? (
                      <img
                        key={r.id}
                        src={r.avatar_url}
                        alt={r.name}
                        title={r.name}
                        className="h-7 w-7 rounded-full border border-zinc-900"
                      />
                    ) : (
                      <div
                        key={r.id}
                        title={r.name}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-900 bg-zinc-700 text-xs font-semibold text-zinc-300"
                      >
                        {r.name.charAt(0)}
                      </div>
                    )
                  )}
                  {mr.reviewers.length > 4 && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-900 bg-zinc-700 text-xs font-semibold text-zinc-400">
                      +{mr.reviewers.length - 4}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-sm text-zinc-500 flex-wrap">
            <span className="flex items-center gap-2">
              <GitMerge size={16} />
              {mr.source_branch} &rarr; {mr.target_branch}
            </span>
            <span>{mr.author.name}</span>
            <span>{relativeTime(mr.updated_at)}</span>
            {mr.user_notes_count > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare size={14} />
                {mr.user_notes_count}
              </span>
            )}
            {mr.labels.length > 0 && (
              <div className="flex gap-2">
                {mr.labels.slice(0, 3).map((l) => (
                  <Badge key={l} variant="default" className="text-xs">
                    {l}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            window.open(mr.web_url, '_blank')
          }}
          title="Open in GitLab"
        >
          <ExternalLink size={18} />
        </Button>
      </div>
    </Card>
  )
}
