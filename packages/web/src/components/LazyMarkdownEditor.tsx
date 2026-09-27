import { lazy } from 'react'

/** The markdown editor (Milkdown), loaded on first use: it is large and most views don't need it. */
export const LazyMarkdownEditor = lazy(() =>
  import('./markdown/MarkdownEditor').then((m) => ({ default: m.MarkdownEditor })),
)
