import { lazy, Suspense } from 'react'

const LazyMarkdownContent = lazy(() => import('./markdown-impl').then((m) => ({ default: m.MarkdownContent })))

interface MarkdownContentProps {
  children: string
  raw?: boolean
  className?: string
}

export function MarkdownContent(props: MarkdownContentProps) {
  return (
    <Suspense>
      <LazyMarkdownContent {...props} />
    </Suspense>
  )
}
