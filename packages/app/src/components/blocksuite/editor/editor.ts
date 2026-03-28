import { AffineEditorContainer } from '@blocksuite/presets'
import type { Doc } from '@blocksuite/store'
import { CollectionProvider } from './provider/provider'
import '@blocksuite/presets/themes/affine.css'

export async function initEditorForPage(pageId: string, title?: string) {
  const provider = await CollectionProvider.init()
  const { collection } = provider

  const doc = await provider.ensurePageDoc(pageId, title)

  const editor = new AffineEditorContainer()
  if (doc) {
    editor.doc = doc
  }

  editor.slots.docLinkClicked.on(({ docId }) => {
    const target = collection.getDoc(docId) as Doc
    if (target) editor.doc = target
  })

  return { editor, provider, collection }
}
