import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useFolders, useDocuments, useCreateFolder, useRenameFolder, useDeleteFolder, useCreateDocument, useUpdateDocument, useDeleteDocument } from '@/hooks/useDocuments'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { MilkdownEditor } from '@/components/ui/milkdown-editor'
import { cn } from '@/lib/utils'
import { FolderOpen, Plus, FileText, Pencil, Trash2, Save, Loader2, ArrowLeft, ChevronRight } from 'lucide-react'
import type { Document } from '@/types/document'

// ─── View: Folders ───

function FoldersView({
  onSelectFolder,
}: {
  onSelectFolder: (name: string) => void
}) {
  const { data: folders = [], isLoading } = useFolders()
  const createFolderMut = useCreateFolder()
  const renameFolderMut = useRenameFolder()
  const deleteFolderMut = useDeleteFolder()

  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null)
  const [renameFolderName, setRenameFolderName] = useState('')

  const handleCreate = () => {
    if (!newFolderName.trim()) return
    createFolderMut.mutate(newFolderName.trim(), {
      onSuccess: () => { setNewFolderName(''); setShowNewFolder(false) },
    })
  }

  const handleRename = (oldName: string) => {
    if (!renameFolderName.trim()) return
    renameFolderMut.mutate({ oldName, newName: renameFolderName.trim() }, {
      onSuccess: () => setRenamingFolder(null),
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Folders</h2>
          <p className="text-base text-zinc-500 mt-1">Organize your rules and guidelines</p>
        </div>
        <Button onClick={() => setShowNewFolder(true)} className="gap-2 text-base h-11 px-5">
          <Plus size={20} /> New Folder
        </Button>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <Card className="p-5 mb-6 border-teal-500/30">
          <div className="flex items-center gap-3">
            <FolderOpen size={24} className="text-teal-400 shrink-0" />
            <Input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName('') }
              }}
              placeholder="Folder name..."
              className="text-base h-11 flex-1"
              autoFocus
            />
            <Button onClick={handleCreate} disabled={createFolderMut.isPending} className="h-11 px-5">
              {createFolderMut.isPending ? <Loader2 size={18} className="animate-spin" /> : 'Create'}
            </Button>
            <Button variant="ghost" className="h-11" onClick={() => { setShowNewFolder(false); setNewFolderName('') }}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-zinc-500" />
        </div>
      )}

      {!isLoading && folders.length === 0 && !showNewFolder && (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
          <FolderOpen size={64} className="mb-4 text-zinc-700" />
          <p className="text-lg">No folders yet</p>
          <p className="text-base text-zinc-600 mt-1">Create a folder to start organizing your documents</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {folders.map(folder => (
          <div key={folder.name} className="group">
            {renamingFolder === folder.name ? (
              <Card className="p-5 border-teal-500/30">
                <div className="flex items-center gap-3">
                  <Input
                    value={renameFolderName}
                    onChange={e => setRenameFolderName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(folder.name)
                      if (e.key === 'Escape') setRenamingFolder(null)
                    }}
                    className="text-base h-11 flex-1"
                    autoFocus
                  />
                  <Button size="sm" className="h-9" onClick={() => handleRename(folder.name)}>
                    <Save size={16} />
                  </Button>
                </div>
              </Card>
            ) : (
              <Card
                className="p-6 cursor-pointer hover:border-teal-500/30 hover:bg-white/[0.04] transition-all"
                onClick={() => onSelectFolder(folder.name)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-teal-500/10">
                      <FolderOpen size={28} className="text-teal-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-100">{folder.name}</h3>
                      <p className="text-sm text-zinc-500 mt-0.5">
                        {folder.docCount} document{folder.docCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="hidden group-hover:flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => { setRenamingFolder(folder.name); setRenameFolderName(folder.name) }}
                      >
                        <Pencil size={16} className="text-zinc-400" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                            <Trash2 size={16} className="text-zinc-400" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete folder "{folder.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the folder and all {folder.docCount} document{folder.docCount !== 1 ? 's' : ''} inside it.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" onClick={() => deleteFolderMut.mutate(folder.name)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    <ChevronRight size={20} className="text-zinc-600 ml-2" />
                  </div>
                </div>
              </Card>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── View: Documents in a folder ───

function DocumentsView({
  folder,
  initialDoc,
  onBack,
  onNavigateDoc,
}: {
  folder: string
  initialDoc?: string
  onBack: () => void
  onNavigateDoc: (docTitle: string | null) => void
}) {
  const { data: documents = [], isLoading } = useDocuments(folder)
  const createDocument = useCreateDocument()
  const updateDocument = useUpdateDocument()
  const deleteDocument = useDeleteDocument()

  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [docContent, setDocContent] = useState('')
  const [initialDocApplied, setInitialDocApplied] = useState(false)

  // Select doc from URL param or auto-select first
  useEffect(() => {
    if (documents.length === 0 || isCreating) return
    if (selectedDoc) return

    if (initialDoc && !initialDocApplied) {
      const doc = documents.find(d => d.title === initialDoc)
      if (doc) {
        setSelectedDoc(doc)
        setDocTitle(doc.title)
        setDocContent(doc.content)
        setInitialDocApplied(true)
        return
      }
    }

    // Fallback: select first doc
    const doc = documents[0]
    setSelectedDoc(doc)
    setDocTitle(doc.title)
    setDocContent(doc.content)
    onNavigateDoc(doc.title)
  }, [documents, selectedDoc, isCreating, initialDoc, initialDocApplied, onNavigateDoc])

  const selectDoc = (doc: Document) => {
    setSelectedDoc(doc)
    setIsCreating(false)
    setDocTitle(doc.title)
    setDocContent(doc.content)
    onNavigateDoc(doc.title)
  }

  const startNew = () => {
    setSelectedDoc(null)
    setIsCreating(true)
    setDocTitle('')
    setDocContent('')
    onNavigateDoc(null)
  }

  const handleSave = () => {
    if (!docTitle.trim()) return
    if (isCreating) {
      createDocument.mutate({ folder, title: docTitle.trim(), content: docContent }, {
        onSuccess: (doc) => {
          setIsCreating(false)
          setSelectedDoc(doc)
          onNavigateDoc(doc.title)
        },
      })
    } else if (selectedDoc) {
      updateDocument.mutate({ path: selectedDoc.path, title: docTitle.trim(), content: docContent }, {
        onSuccess: (doc) => {
          setSelectedDoc(doc)
          onNavigateDoc(doc.title)
        },
      })
    }
  }

  const handleDelete = (doc: Document) => {
    deleteDocument.mutate(doc.path, {
      onSuccess: () => {
        if (selectedDoc?.path === doc.path) {
          setSelectedDoc(null)
          setDocTitle('')
          setDocContent('')
          onNavigateDoc(null)
        }
      },
    })
  }

  const isSaving = createDocument.isPending || updateDocument.isPending
  const isEditing = isCreating || selectedDoc !== null

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-10 w-10 p-0">
            <ArrowLeft size={22} />
          </Button>
          <FolderOpen size={24} className="text-teal-400" />
          <h2 className="text-xl font-bold text-zinc-100">{folder}</h2>
          <span className="text-base text-zinc-500">({documents.length} docs)</span>
        </div>
        <Button onClick={startNew} className="gap-2 text-base h-10 px-5">
          <Plus size={18} /> New Document
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Document list sidebar */}
        <div className="w-72 shrink-0 border-r border-white/[0.06] flex flex-col">
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={22} className="animate-spin text-zinc-500" />
              </div>
            )}

            {!isLoading && documents.length === 0 && !isCreating && (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <FileText size={36} className="mb-3 text-zinc-700" />
                <p className="text-base">No documents</p>
              </div>
            )}

            {isCreating && (
              <div
                className="flex items-center gap-3 w-full rounded-lg px-4 py-3 bg-teal-500/10 text-teal-300 border border-teal-500/20"
              >
                <FileText size={20} className="shrink-0" />
                <span className="text-base font-medium truncate">New document</span>
              </div>
            )}

            {documents.map(doc => (
              <button
                key={doc.path}
                onClick={() => selectDoc(doc)}
                className={cn(
                  'flex items-center gap-3 w-full rounded-lg px-4 py-3 text-left transition-colors',
                  selectedDoc?.path === doc.path && !isCreating
                    ? 'bg-white/[0.08] text-zinc-100'
                    : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'
                )}
              >
                <FileText size={20} className={cn('shrink-0', selectedDoc?.path === doc.path && !isCreating ? 'text-teal-400' : '')} />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium truncate">{doc.title}</p>
                  <p className="text-xs text-zinc-600 mt-0.5 truncate">
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 flex flex-col min-w-0">
          {isEditing ? (
            <div className="flex-1 flex flex-col p-5 gap-4">
              <div className="flex items-center gap-4">
                <Input
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                  placeholder="Document title..."
                  className="text-lg font-semibold flex-1 h-12"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <Button onClick={handleSave} disabled={!docTitle.trim() || isSaving} className="h-10 px-5 gap-2 text-base">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Save
                  </Button>
                  {selectedDoc && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                          <Trash2 size={18} className="text-zinc-400" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{selectedDoc.title}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete {selectedDoc.path}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={() => handleDelete(selectedDoc)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-0">
                <MilkdownEditor
                  value={docContent}
                  onChange={setDocContent}
                  placeholder="Write your rules, guidelines, or coding standards in markdown..."
                  minHeight="calc(100vh - 250px)"
                />
              </div>

              <p className="text-sm text-zinc-600">
                Saves as <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-sm">{folder}/{docTitle.trim() || 'untitled'}.md</code>
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-zinc-500">
              <FileText size={56} className="mb-4 text-zinc-700" />
              <p className="text-lg">Select a document or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───

export function DocumentsPage() {
  const { folder, doc } = useParams<{ folder?: string; doc?: string }>()
  const navigate = useNavigate()

  const handleSelectFolder = (name: string) => {
    navigate(`/documents/${encodeURIComponent(name)}`)
  }

  const handleBack = () => {
    navigate('/documents')
  }

  const handleNavigateDoc = useCallback((docTitle: string | null) => {
    if (!folder) return
    if (docTitle) {
      navigate(`/documents/${encodeURIComponent(folder)}/${encodeURIComponent(docTitle)}`, { replace: true })
    } else {
      navigate(`/documents/${encodeURIComponent(folder)}`, { replace: true })
    }
  }, [folder, navigate])

  return (
    <div className="flex h-full flex-col">
      {/* Page header — only on folders view */}
      {!folder && (
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-8 py-5">
          <FileText size={26} className="text-teal-400" />
          <h1 className="text-2xl font-bold text-zinc-100">Documents</h1>
        </div>
      )}

      {folder ? (
        <DocumentsView
          folder={folder}
          initialDoc={doc}
          onBack={handleBack}
          onNavigateDoc={handleNavigateDoc}
        />
      ) : (
        <FoldersView onSelectFolder={handleSelectFolder} />
      )}
    </div>
  )
}
