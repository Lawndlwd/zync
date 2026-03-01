import { useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
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

  return (
    <div className={`markdown-content ${className}`}>
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300 break-all"
          >
            {children}
          </a>
        ),
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        h1: ({ children }) => <h1 className="text-base font-bold text-zinc-100 mt-4 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold text-zinc-100 mt-3 mb-1.5">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-zinc-200 mt-3 mb-1">{children}</h3>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        code: ({ className, children }) => {
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return (
              <code className="block overflow-x-auto rounded-md bg-white/[0.04] border border-white/[0.08] p-3 text-xs font-mono text-zinc-300 my-2">
                {children}
              </code>
            )
          }
          return (
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs font-mono text-zinc-300">
              {children}
            </code>
          )
        },
        pre: ({ children }) => <pre className="overflow-x-auto">{children}</pre>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-white/[0.1] pl-3 my-2 text-zinc-400 italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-white/[0.08] my-3" />,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-white/[0.1] bg-white/[0.05] px-2 py-1 text-left font-medium text-zinc-300">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-white/[0.08] px-2 py-1 text-zinc-400">{children}</td>
        ),
        img: ({ src, alt, width, height }) => (
          <img src={src} alt={alt || ''} width={width} height={height} className="max-w-full rounded-md my-2" />
        ),
        // HTML elements that GitLab/Renovate bot uses
        details: ({ children }) => (
          <details className="my-3 rounded-lg border border-white/[0.08] bg-white/[0.03] overflow-hidden group">
            {children}
          </details>
        ),
        summary: ({ children }) => (
          <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-zinc-200 bg-white/[0.04] hover:bg-white/[0.08] transition-colors list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
            <svg className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform group-open:rotate-90" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
            </svg>
            {children}
          </summary>
        ),
        input: ({ type, checked, ...props }) => {
          if (type === 'checkbox') {
            return (
              <input
                type="checkbox"
                checked={checked}
                readOnly
                className="mr-1.5 h-3.5 w-3.5 rounded border-zinc-600 bg-white/[0.04] text-indigo-500 align-middle"
                {...props}
              />
            )
          }
          return <input type={type} {...props} />
        },
      }}
    >
      {content}
    </Markdown>
    </div>
  )
}
