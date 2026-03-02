import { lazy, Suspense } from 'react'
import type { AttachmentMap } from '@/lib/jira-markup'

const LazyMarkdownContent = lazy(() =>
  import('./markdown-impl').then(m => ({ default: m.MarkdownContent }))
)

interface MarkdownContentProps {
  children: string
  raw?: boolean
  className?: string
  attachments?: AttachmentMap
  gitlabBaseUrl?: string
  gitlabProjectId?: number
}

export function MarkdownContent(props: MarkdownContentProps) {
  return (
    <Suspense>
      <LazyMarkdownContent {...props} />
    </Suspense>
  )
}
