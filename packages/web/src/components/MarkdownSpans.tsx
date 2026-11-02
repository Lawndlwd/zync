import { Link } from 'react-router'

import { type MdSpan, mdSpans } from '../helpers/markdownLite'
import { fileUrl } from '../helpers/urls'

/** One line of markdown-lite: bold, italic, code, and links (workspace files open in the app). */
export function MarkdownSpans({ ws, text }: { ws: string; text: string }) {
  return mdSpans(text).map((s: MdSpan, i) => {
    const key = `${i}:${s.text}`
    if (s.href)
      return /^[a-z]+:/i.test(s.href) ? (
        <a key={key} className="link-inline" href={s.href} target="_blank" rel="noreferrer">
          {s.text}
        </a>
      ) : (
        <Link key={key} className="link-inline" to={fileUrl(ws, s.href)}>
          {s.text}
        </Link>
      )
    if (s.bold) return <b key={key}>{s.text}</b>
    if (s.italic) return <i key={key}>{s.text}</i>
    if (s.code) return <code key={key}>{s.text}</code>
    return <span key={key}>{s.text}</span>
  })
}
