export interface AttachmentMap {
  [filename: string]: string // filename → proxied URL
}

/**
 * Converts Jira wiki markup to Markdown.
 * Handles the most common Jira text formatting notation patterns.
 * Pass attachments map to resolve !filename! to real image URLs.
 */
export function jiraToMarkdown(text: string, attachments?: AttachmentMap): string {
  if (!text) return ''

  let result = text

  // Images: !filename.png|width=373,height=164! → ![](url)
  result = result.replace(
    /!([^|!\n]+?)(?:\|([^!\n]*?))?!/g,
    (_match, src: string, _props: string) => {
      // If src looks like a URL, use it directly
      if (src.startsWith('http://') || src.startsWith('https://')) {
        return `![](${src})`
      }
      // Resolve from attachments map
      if (attachments && attachments[src]) {
        return `![${src}](${attachments[src]})`
      }
      // Fallback — show filename as alt text, no broken image
      return `\`[image: ${src}]\``
    }
  )

  // Links: [text|url] or [url] → [text](url)
  result = result.replace(
    /\[([^|\]\n]+?)\|([^\]\n]+?)\]/g,
    (_match, label: string, url: string) => `[${label}](${url})`
  )
  result = result.replace(
    /\[([^\]\n]+?)\]/g,
    (_match, url: string) => {
      // Only convert if it looks like a URL
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
        return `[${url}](${url})`
      }
      return `[${url}]`
    }
  )

  // Headings: h1. text → # text (h1 through h6)
  result = result.replace(/^h([1-6])\.\s+(.+)$/gm, (_match, level: string, content: string) => {
    return '#'.repeat(parseInt(level)) + ' ' + content
  })

  // Bold: *text* → **text** (but not in the middle of words)
  // Be careful not to match markdown ** or list items
  result = result.replace(/(?<!\w)\*([^\*\n]+?)\*(?!\w)/g, '**$1**')

  // Italic: _text_ → *text* (but not in URLs or mid-word)
  result = result.replace(/(?<![:\w])_([^_\n]+?)_(?!\w)/g, '*$1*')

  // Strikethrough: -text- → ~~text~~
  result = result.replace(/(?<!\w)-([^\-\n]+?)-(?!\w)/g, '~~$1~~')

  // Monospace: {{text}} → `text`
  result = result.replace(/\{\{([^}]+?)\}\}/g, '`$1`')

  // Code blocks: {code:lang} or {code}...{code} → ```lang\n...\n```
  result = result.replace(
    /\{code(?::([a-zA-Z]+))?\}([\s\S]*?)\{code\}/g,
    (_match, lang: string | undefined, code: string) => {
      return '```' + (lang || '') + '\n' + code.trim() + '\n```'
    }
  )

  // Noformat: {noformat}...{noformat} → ```\n...\n```
  result = result.replace(
    /\{noformat\}([\s\S]*?)\{noformat\}/g,
    (_match, content: string) => '```\n' + content.trim() + '\n```'
  )

  // Quote blocks: {quote}...{quote} → > lines
  result = result.replace(
    /\{quote\}([\s\S]*?)\{quote\}/g,
    (_match, content: string) => {
      return content.trim().split('\n').map((line: string) => `> ${line}`).join('\n')
    }
  )

  // Color/panel macros: {color:red}text{color} → just text
  result = result.replace(/\{color:[^}]+\}([\s\S]*?)\{color\}/g, '$1')

  // Panel: {panel:title=X}...{panel} → just content
  result = result.replace(/\{panel(?::[^}]*)?\}([\s\S]*?)\{panel\}/g, '$1')

  // Ordered lists: # item → 1. item (Jira uses # for ordered lists)
  // Must handle multiple levels: ## → nested
  result = result.replace(/^#{3}\s+(.+)$/gm, '      1. $1')
  result = result.replace(/^#{2}\s+(.+)$/gm, '   1. $1')
  result = result.replace(/^#\s+(.+)$/gm, '1. $1')

  // Unordered lists: already uses - or *, markdown compatible
  // But Jira also uses ** for nested: ** item → nested bullet
  result = result.replace(/^\*{3}\s+(.+)$/gm, '      - $1')
  result = result.replace(/^\*{2}\s+(.+)$/gm, '   - $1')

  // Tables: ||header||header|| → |header|header| with separator
  // First handle header rows
  result = result.replace(/^\|\|(.+?)\|\|\s*$/gm, (_match, content: string) => {
    const cells = content.split('||')
    const header = '| ' + cells.join(' | ') + ' |'
    const separator = '| ' + cells.map(() => '---').join(' | ') + ' |'
    return header + '\n' + separator
  })

  // Table data rows: |cell|cell| → |cell|cell| (already compatible mostly)
  // But need to ensure proper spacing
  result = result.replace(/^\|(.+?)\|\s*$/gm, (_match, content: string) => {
    // Don't touch if it's already a markdown table separator
    if (content.match(/^[\s\-|]+$/)) return _match
    const cells = content.split('|')
    return '| ' + cells.join(' | ') + ' |'
  })

  // Horizontal rule: ---- → ---
  result = result.replace(/^-{4,}\s*$/gm, '---')

  // Line breaks: \\ → <br> or newline
  result = result.replace(/\\\\/g, '  \n')

  return result
}
