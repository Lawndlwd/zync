import type { ReactNode } from 'react'

// Same matching rules as the server's full-text search (api/src/search.ts): case and accents are
// ignored, words match as prefixes anywhere in the text.

const fold = (s: string) => s.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase()

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
  // oxlint-disable-next-line typescript/no-misused-spread -- fold() normalizes; code-point splitting is intentional for matching
  const chars = [...text]
  const folded = chars.map((c) => fold(c) || c)
  const flat = folded.join('')
  const starts: number[] = []
  let pos = 0
  for (const f of folded) {
    starts.push(pos)
    pos += f.length
  }
  const marks = Array.from({ length: chars.length }, () => false)
  for (const w of [...words].toSorted((a, b) => b.length - a.length)) {
    for (let i = flat.indexOf(w); i >= 0; i = flat.indexOf(w, i + w.length)) {
      chars.forEach((_, k) => {
        const at = starts[k] ?? -1
        if (at >= i && at < i + w.length) marks[k] = true
      })
    }
  }
  const out: ReactNode[] = []
  let run = ''
  let bold = false
  for (const [k, c] of chars.entries()) {
    if (marks[k] !== bold && run) {
      out.push(bold ? <b key={out.length}>{run}</b> : run)
      run = ''
    }
    bold = marks[k] === true
    run += c
  }
  if (run) out.push(bold ? <b key={out.length}>{run}</b> : run)
  return out
}
