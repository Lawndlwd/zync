import type { AffineEditorContainer } from '@blocksuite/presets'
import { useEffect, useState } from 'react'
import { EditorContext } from '../editor/context'
import { initEditorForPage } from '../editor/editor'
import type { CollectionProvider as CollectionProviderType } from '../editor/provider/provider'

interface EditorProviderProps {
  children: React.ReactNode
  pageId: string
  title?: string
}

export function EditorProvider({ children, pageId, title }: EditorProviderProps) {
  const [editor, setEditor] = useState<AffineEditorContainer | null>(null)
  const [provider, setProvider] = useState<CollectionProviderType | null>(null)

  useEffect(() => {
    let cancelled = false

    initEditorForPage(pageId, title)
      .then(({ editor, provider }) => {
        if (!cancelled) {
          setEditor(editor)
          setProvider(provider)
        }
      })
      .catch((err) => {
        console.error('[BlockSuite] Failed to init editor:', err)
      })

    return () => {
      cancelled = true
    }
  }, [pageId])

  return <EditorContext.Provider value={{ editor, provider }}>{children}</EditorContext.Provider>
}
