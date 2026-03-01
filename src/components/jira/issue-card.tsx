import type { JiraIssue } from '@/types/jira'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { relativeTime } from '@/lib/utils'
import { ExternalLink, MessageSquare } from 'lucide-react'

const priorityVariant = (name: string) => {
  switch (name.toLowerCase()) {
    case 'highest':
    case 'critical':
      return 'danger' as const
    case 'high':
      return 'warning' as const
    case 'medium':
      return 'info' as const
    default:
      return 'default' as const
  }
}

const statusVariant = (category: string) => {
  switch (category) {
    case 'done':
      return 'success' as const
    case 'indeterminate':
      return 'primary' as const
    default:
      return 'default' as const
  }
}

interface IssueCardProps {
  issue: JiraIssue
  onSelect: (issue: JiraIssue) => void
  onTransition?: (issue: JiraIssue) => void
}

export function IssueCard({ issue, onSelect, onTransition }: IssueCardProps) {
  return (
    <Card
      className="cursor-pointer p-4 transition-colors hover:border-zinc-700"
      onClick={() => onSelect(issue)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-sm font-mono text-indigo-400">{issue.key}</span>
            <Badge variant={statusVariant(issue.status.category)}>{issue.status.name}</Badge>
            <Badge variant={priorityVariant(issue.priority.name)}>{issue.priority.name}</Badge>
          </div>
          <p className="text-base font-medium text-zinc-200 truncate">{issue.summary}</p>
          <div className="mt-2 flex items-center gap-3 text-sm text-zinc-500">
            {issue.sprint && <span>{issue.sprint.name}</span>}
            <span>{relativeTime(issue.updated)}</span>
            {issue.labels.length > 0 && (
              <div className="flex gap-2">
                {issue.labels.slice(0, 2).map((l) => (
                  <Badge key={l} variant="default" className="text-xs">
                    {l}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              onTransition?.(issue)
            }}
            title="Transition"
          >
            <MessageSquare size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              window.open(`${issue.key}`, '_blank')
            }}
            title="Open in Jira"
          >
            <ExternalLink size={18} />
          </Button>
        </div>
      </div>
    </Card>
  )
}
