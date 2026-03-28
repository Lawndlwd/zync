import { useEffect, useRef } from 'react'
import { useEditor } from '../editor/context'

interface EditorContainerProps {
  compact?: boolean
  autoFocus?: boolean
}

export function EditorContainer({ compact, autoFocus = false }: EditorContainerProps = {}) {
  const editorContext = useEditor()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const editor = editorContext?.editor
    if (!containerRef.current || !editor) return

    if (!editor.doc) {
      console.warn('[BlockSuite] Editor has no doc, skipping mount')
      return
    }

    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(editor)

    const timeouts: ReturnType<typeof setTimeout>[] = []

    // Auto-focus: deep-search for the first contenteditable in shadow DOMs
    if (autoFocus) {
      const tryFocus = () => {
        const root = containerRef.current
        if (!root) return
        const search = (node: Element | ShadowRoot): HTMLElement | null => {
          const el = node.querySelector('[contenteditable="true"]') as HTMLElement | null
          if (el) return el
          for (const child of node.querySelectorAll('*')) {
            if (child.shadowRoot) {
              const inner = search(child.shadowRoot)
              if (inner) return inner
            }
          }
          return null
        }
        const editable = search(root)
        if (editable) editable.focus()
      }
      timeouts.push(setTimeout(tryFocus, 300))
      timeouts.push(setTimeout(tryFocus, 600))
      timeouts.push(setTimeout(tryFocus, 1500))
    }

    return () => {
      timeouts.forEach(clearTimeout)
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [editorContext?.editor, editorContext?.editor?.doc, compact, autoFocus])

  useEffect(() => {
    const html = document.querySelector('html')
    if (html) html.dataset.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  }, [])

  if (!editorContext?.editor?.doc) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading editor...</span>
      </div>
    )
  }

  return <div className="blocksuite-editor-container h-full w-full" ref={containerRef} />
}
