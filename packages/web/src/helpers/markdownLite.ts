// A tiny read-only markdown reader for short generated pages (the daily brief): headings, bullet
// lists, paragraphs, and inline **bold**, *italic*, `code` and [links](url). Anything else shows as
// text. Full pages open in the editor (Milkdown); this only has to read well.

export type MdBlock = { type: 'h'; text: string } | { type: 'li'; text: string } | { type: 'p'; text: string }

export type MdSpan = { text: string; bold?: boolean; italic?: boolean; code?: boolean; href?: string }

export function mdBlocks(source: string): MdBlock[] {
  const out: MdBlock[] = []
  for (const raw of source.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const h = /^#{1,6}\s+(.*)$/.exec(line)
    const li = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line)
    const last = out.at(-1)
    if (h?.[1] !== undefined) out.push({ type: 'h', text: h[1] })
    else if (li?.[1] !== undefined) out.push({ type: 'li', text: li[1] })
    else if (last?.type === 'p') out[out.length - 1] = { type: 'p', text: `${last.text} ${line}` }
    else out.push({ type: 'p', text: line })
  }
  return out
}

const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*|_([^_]+)_/g

/** Only web links (and workspace-relative paths) become links: no javascript: or data: URLs. */
const safeHref = (href: string) =>
  /^(https?:|mailto:)/i.test(href) || !/^[a-z][a-z0-9+.-]*:/i.test(href) ? href : undefined

export function mdSpans(text: string): MdSpan[] {
  const out: MdSpan[] = []
  let at = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index) })
    const [, label, href, bold, code, italic, underscored] = m
    if (label !== undefined && href !== undefined) {
      const safe = safeHref(href)
      out.push(safe ? { text: label, href: safe } : { text: label })
    } else if (bold !== undefined) out.push({ text: bold, bold: true })
    else if (code !== undefined) out.push({ text: code, code: true })
    else out.push({ text: italic ?? underscored ?? '', italic: true })
    at = m.index + m[0].length
  }
  if (at < text.length) out.push({ text: text.slice(at) })
  return out
}
