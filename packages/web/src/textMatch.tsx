import type { ReactNode } from 'react'

// Same matching rules as the server's full-text search (api/src/search.ts): case and accents are
// ignored, words match as prefixes anywhere in the text.

export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export function queryWords(q: string): string[] {
  return [
    ...new Set(
      fold(q)
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean),
    ),
  ]
}

/** Every query word appears in `text`. */
export const matchesAll = (text: string, words: string[]) => {
  const t = fold(text)
  return words.every((w) => t.includes(w))
}

/** `text` with each occurrence of any query word in bold (accent-insensitive). */
export function highlight(text: string, words: string[]): ReactNode {
  if (!words.length) return text
  // Fold char by char so positions map back onto the original text.
  const chars = [...text]
  const folded = chars.map((c) => fold(c) || c)
  const flat = folded.join('')
  const starts: number[] = []
  let pos = 0
  for (const f of folded) {
    starts.push(pos)
    pos += f.length
  }
  const marks = new Array(chars.length).fill(false)
  for (const w of [...words].sort((a, b) => b.length - a.length)) {
    for (let i = flat.indexOf(w); i >= 0; i = flat.indexOf(w, i + w.length)) {
      chars.forEach((_, k) => {
        if (starts[k] >= i && starts[k] < i + w.length) marks[k] = true
      })
    }
  }
  const out: ReactNode[] = []
  let run = ''
  let bold = false
  chars.forEach((c, k) => {
    if (marks[k] !== bold && run) {
      out.push(bold ? <b key={out.length}>{run}</b> : run)
      run = ''
    }
    bold = marks[k]
    run += c
  })
  if (run) out.push(bold ? <b key={out.length}>{run}</b> : run)
  return <>{out}</>
}
