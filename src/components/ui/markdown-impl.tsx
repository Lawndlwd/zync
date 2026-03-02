import { useMemo, useRef, useLayoutEffect } from 'react'
import { Crepe } from '@milkdown/crepe'
import { CrepeFeature } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame-dark.css'
import '@/styles/milkdown.css'
import { jiraToMarkdown, type AttachmentMap } from '@/lib/jira-markup'
import { rewriteGitlabMarkdownImages } from '@/lib/gitlab-images'

interface MarkdownContentProps {
  children: string
  /** Set to true to skip Jira wiki markup detection (e.g. for AI chat) */
  raw?: boolean
  className?: string
  /** Map of filename → proxied URL for resolving Jira !image! attachments */
  attachments?: AttachmentMap
  /** GitLab base URL — when set, image URLs are rewritten to proxy through backend */
  gitlabBaseUrl?: string
  /** GitLab project ID — needed to resolve relative /uploads/ paths */
  gitlabProjectId?: number
}

/**
 * Detects if text contains Jira wiki markup patterns.
 */
function isJiraMarkup(text: string): boolean {
  // Check for common Jira-specific patterns
  return (
    /!\S+[^!]*!/.test(text) ||              // !image.png! or !image|props!
    /\[[^\]]+\|[^\]]+\]/.test(text) ||      // [text|url]
    /\[https?:\/\/[^\]]+\]/.test(text) ||   // [https://url]
    /^h[1-6]\.\s/m.test(text) ||            // h1. heading
    /\{code[}:]/.test(text) ||              // {code} or {code:java}
    /\{noformat\}/.test(text) ||            // {noformat}
    /\{quote\}/.test(text) ||               // {quote}
    /\{\{[^}]+\}\}/.test(text) ||           // {{monospace}}
    /^\|\|.+\|\|/m.test(text)               // ||table header||
  )
}

export function MarkdownContent({ children, raw = false, className = '', attachments, gitlabBaseUrl, gitlabProjectId }: MarkdownContentProps) {
  const content = useMemo(() => {
    if (!children) return ''
    let text = children
    if (!raw && isJiraMarkup(text)) {
      text = jiraToMarkdown(text, attachments)
    }
    // Rewrite GitLab image URLs to proxy
    if (gitlabBaseUrl) {
      text = rewriteGitlabMarkdownImages(text, gitlabBaseUrl, gitlabProjectId)
    }
    return text
  }, [children, raw, attachments, gitlabBaseUrl, gitlabProjectId])

  const containerRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const contentRef = useRef(content)

  // Create / destroy Crepe editor in readonly mode
  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root || !content) return

    contentRef.current = content

    const crepe = new Crepe({
      root,
      defaultValue: content,
      features: {
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.Placeholder]: false,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.Cursor]: false,
      },
    })

    crepe.setReadonly(true)

    crepe.create().then(() => {
      crepeRef.current = crepe
    })

    return () => {
      crepeRef.current = null
      crepe.destroy()
    }
  }, [content])

  if (!content) return null

  return (
    <div
      ref={containerRef}
      className={`milkdown-editor-wrapper milkdown-editor-readonly ${className}`}
    />
  )
}
