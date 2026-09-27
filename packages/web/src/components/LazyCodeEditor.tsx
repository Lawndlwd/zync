import { lazy } from 'react'

/** The code editor (CodeMirror), loaded on first use. */
export const LazyCodeEditor = lazy(() => import('./CodeEditor').then((m) => ({ default: m.CodeEditor })))
