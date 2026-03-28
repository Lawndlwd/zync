import { ArrowLeft, Loader2, Pin, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { EditorContainer } from '@/components/blocksuite/components/EditorContainer'
import { EditorProvider } from '@/components/blocksuite/components/EditorProvider'
import { ModeToggle } from '@/components/blocksuite/components/ModeToggle'
import { useEditor } from '@/components/blocksuite/editor/context'
import { Button } from '@/components/ui/button'
import { useDeletePage, usePlannerPage, useUpdatePage } from '@/hooks/usePlanner'

interface PageViewProps {
  pageId: string
  onNavigate: () => void
}

export function PageView({ pageId, onNavigate }: PageViewProps) {
  const { data: page, isLoading } = usePlannerPage(pageId)
  const updatePage = useUpdatePage()
  const deletePage = useDeletePage()

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!page) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Page not found</p>
        <Button variant="ghost" onClick={onNavigate}>
          Go back
        </Button>
      </div>
    )
  }

  return (
    <EditorProvider pageId={page.id}>
      <PageViewInner page={page} onNavigate={onNavigate} updatePage={updatePage} deletePage={deletePage} />
    </EditorProvider>
  )
}

function PageViewInner({
  page,
  onNavigate,
  updatePage,
  deletePage,
}: {
  page: { id: string; title: string; icon: string; pinned: boolean; isSystem: boolean }
  onNavigate: () => void
  updatePage: ReturnType<typeof useUpdatePage>
  deletePage: ReturnType<typeof useDeletePage>
}) {
  const editorCtx = useEditor()
  const [displayTitle, setDisplayTitle] = useState(page.title)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedTitle = useRef(page.title)

  // Set initial doc title from page data when editor loads
  useEffect(() => {
    const editor = editorCtx?.editor
    if (!editor?.doc) return
    const root = editor.doc.root as any
    if (root?.title && page.title) {
      const currentDocTitle = root.title.toString()
      if (!currentDocTitle || currentDocTitle === '') {
        root.title.replace(0, root.title.length, page.title)
      }
    }
  }, [editorCtx?.editor?.doc, page.title])

  // Listen to doc title changes and sync to toolbar + server
  useEffect(() => {
    const editor = editorCtx?.editor
    if (!editor?.doc) return

    const checkTitle = () => {
      const root = editor.doc?.root as any
      if (!root?.title) return
      const docTitle = root.title.toString().trim()
      if (docTitle && docTitle !== lastSavedTitle.current) {
        setDisplayTitle(docTitle)
        // Debounce save to server
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => {
          lastSavedTitle.current = docTitle
          updatePage.mutate({ id: page.id, title: docTitle })
        }, 800)
      }
    }

    // Listen to Yjs updates on the doc
    const doc = editor.doc
    const yDoc = (doc as any).spaceDoc || (doc as any)._yDoc
    if (yDoc?.on) {
      yDoc.on('update', checkTitle)
      return () => {
        yDoc.off('update', checkTitle)
        if (saveTimer.current) clearTimeout(saveTimer.current)
      }
    }
  }, [editorCtx?.editor?.doc, page.id, updatePage])

  // Update display title when page data changes externally
  useEffect(() => {
    setDisplayTitle(page.title)
    lastSavedTitle.current = page.title
  }, [page.title])

  const handlePinToggle = () => {
    updatePage.mutate({ id: page.id, pinned: !page.pinned })
  }

  const handleDelete = () => {
    if (page.isSystem) return
    deletePage.mutate(page.id, { onSuccess: onNavigate })
  }

  // Escape to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onNavigate()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onNavigate])

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between border-b border-border bg-background/90 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="xs" onClick={onNavigate}>
            <ArrowLeft size={16} />
          </Button>
          <span className="text-lg">{page.icon}</span>
          <span className="text-sm text-muted-foreground truncate max-w-[300px]">{displayTitle || 'Untitled'}</span>
        </div>
        <div className="flex items-center gap-1">
          <ModeToggle />
          <Button variant="ghost" size="xs" onClick={handlePinToggle}>
            <Pin size={14} className={page.pinned ? 'text-primary' : 'text-muted-foreground'} />
          </Button>
          {!page.isSystem && (
            <Button variant="ghost" size="xs" onClick={handleDelete}>
              <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {/* BlockSuite Editor */}
      <div className="flex-1 overflow-hidden">
        <EditorContainer />
      </div>
    </div>
  )
}
