import { FileText, PenTool } from 'lucide-react'
import { useState } from 'react'
import { useEditor } from '../editor/context'

export function ModeToggle() {
  const editorContext = useEditor()
  const [mode, setMode] = useState<'page' | 'edgeless'>('page')

  const toggleMode = () => {
    if (!editorContext?.editor) return
    const newMode = mode === 'page' ? 'edgeless' : 'page'
    editorContext.editor.mode = newMode
    setMode(newMode)
  }

  return (
    <button
      onClick={toggleMode}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      title={mode === 'page' ? 'Switch to Canvas' : 'Switch to Doc'}
    >
      {mode === 'page' ? (
        <>
          <PenTool size={14} />
          <span>Canvas</span>
        </>
      ) : (
        <>
          <FileText size={14} />
          <span>Doc</span>
        </>
      )}
    </button>
  )
}
