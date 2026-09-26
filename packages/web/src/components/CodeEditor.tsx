import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { bracketMatching, foldGutter, HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { linter, lintGutter } from '@codemirror/lint'
import { EditorState } from '@codemirror/state'
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { useEffect, useRef } from 'react'

// Code editor in the zync style (CodeMirror 6). Uncontrolled: remount via `key` to load new content.

const zyncTheme = EditorView.theme({
  '&': {
    color: 'var(--ink)',
    backgroundColor: 'var(--raised)',
    fontSize: '13px',
    border: '1px dashed var(--line)',
    borderRadius: 'var(--r-md)',
    height: '100%',
  },
  '&.cm-focused': { outline: 'none', border: '1px solid var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' },
  '.cm-scroller': { fontFamily: 'var(--f-mono)', lineHeight: '1.65', overflow: 'auto' },
  '.cm-content': { padding: '12px 0', caretColor: 'var(--ink)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ink)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--accent-soft) !important',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--surface)',
    color: 'var(--ink-2)',
    border: 'none',
    borderRight: '1px dashed var(--line)',
    borderRadius: 'var(--r-md) 0 0 var(--r-md)',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent-soft) 35%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--accent-soft)', color: 'var(--on-soft)' },
  '.cm-matchingBracket': { backgroundColor: 'var(--accent-soft)', outline: '1px solid var(--sage-2)' },
  '.cm-foldGutter .cm-gutterElement': { cursor: 'pointer' },
  '.cm-tooltip': {
    backgroundColor: 'var(--raised)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-sm)',
    color: 'var(--ink)',
  },
  '.cm-diagnostic-error': { borderLeftColor: 'var(--danger)' },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy var(--danger)' },
})

const zyncHighlight = HighlightStyle.define([
  { tag: t.propertyName, color: 'var(--accent)', fontWeight: '500' },
  { tag: t.string, color: 'var(--sage-3)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--danger)' },
  { tag: [t.brace, t.squareBracket, t.separator, t.punctuation], color: 'var(--ink-2)' },
])

export function CodeEditor({
  value,
  onChange,
  onSave,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  onSave?: () => void
  ariaLabel: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const cb = useRef({ onChange, onSave })
  cb.current = { onChange, onSave }

  useEffect(() => {
    if (!host.current) return
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          foldGutter(),
          lintGutter(),
          history(),
          indentOnInput(),
          bracketMatching(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          json(),
          linter(jsonParseLinter(), { delay: 300 }),
          syntaxHighlighting(zyncHighlight),
          zyncTheme,
          EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
          keymap.of([
            {
              key: 'Mod-s',
              preventDefault: true,
              run: () => {
                cb.current.onSave?.()
                return true
              },
            },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) cb.current.onChange(u.state.doc.toString())
          }),
        ],
      }),
    })
    return () => view.destroy()
  }, [])

  return <div ref={host} className="code-editor" />
}
