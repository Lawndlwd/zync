/**
 * Rewrites image URLs in markdown content to go through the GitLab proxy.
 *
 * GitLab markdown uses relative paths like `/uploads/{hash}/{filename}` for images.
 * These are project-scoped — the full GitLab URL is:
 *   `{baseUrl}/api/v4/projects/{projectId}/uploads/{hash}/{filename}`
 *
 * Also handles GitLab's `{width=X height=Y}` attribute syntax after images,
 * converting them to `<img>` tags with proper dimensions.
 */
export function rewriteGitlabMarkdownImages(markdown: string, gitlabBaseUrl: string, projectId?: number): string {
  if (!markdown) return markdown

  const rewrite = (url: string): string => {
    if (url.startsWith('/api/gitlab/')) return url

    if (url.startsWith('/uploads/')) {
      if (projectId) {
        return `/api/gitlab/proxy/image?project=${projectId}&path=${encodeURIComponent(url)}`
      }
      return url
    }

    if (gitlabBaseUrl && url.startsWith(gitlabBaseUrl)) {
      const path = url.slice(gitlabBaseUrl.length)
      return `/api/gitlab/proxy/image?path=${encodeURIComponent(path)}`
    }

    return url
  }

  // Rewrite ![alt](url){width=X height=Y} → <img> with dimensions
  // Also handles ![alt](url) without attributes
  let result = markdown.replace(
    /!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?/g,
    (_match, alt: string, url: string, attrs: string | undefined) => {
      const proxied = rewrite(url.trim())
      if (attrs) {
        // Parse {width=900 height=250} style attributes
        const parts: string[] = []
        const widthMatch = attrs.match(/width=(\d+)/)
        const heightMatch = attrs.match(/height=(\d+)/)
        if (widthMatch) parts.push(`width="${widthMatch[1]}"`)
        if (heightMatch) parts.push(`height="${heightMatch[1]}"`)
        const attrStr = parts.length > 0 ? ' ' + parts.join(' ') : ''
        return `<img src="${proxied}" alt="${alt}"${attrStr} />`
      }
      return `![${alt}](${proxied})`
    }
  )

  // Rewrite <img src="url"> patterns
  result = result.replace(
    /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
    (_match, before, url, after) => {
      // Don't double-rewrite images we just created above
      if (url.startsWith('/api/gitlab/')) return _match
      return `<img ${before}src="${rewrite(url.trim())}"${after}>`
    }
  )

  return result
}
