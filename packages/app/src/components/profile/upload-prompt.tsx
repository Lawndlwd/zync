import { useCallback, useState } from 'react'
import { useUploadResume } from '@/hooks/useJobs'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function UploadPrompt() {
  const uploadMutation = useUploadResume()
  const [dragging, setDragging] = useState(false)

  const handleFile = useCallback((file: File) => {
    if (file.type !== 'application/pdf') return
    uploadMutation.mutate(file)
  }, [uploadMutation])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <FileText size={48} className="mx-auto mb-4 text-zinc-600" />
        <h2 className="mb-2 text-lg font-semibold text-zinc-200">Upload Your Resume</h2>
        <p className="mb-6 text-sm text-zinc-500">Upload a PDF resume to populate your profile and start building your CV</p>
        <label
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'mx-auto flex w-80 cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors',
            dragging ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/[0.08] hover:border-white/[0.15]',
            uploadMutation.isPending && 'pointer-events-none opacity-50'
          )}
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 size={28} className="animate-spin text-indigo-400" />
              <span className="text-sm text-zinc-400">Parsing resume...</span>
            </>
          ) : (
            <>
              <Upload size={28} className="text-zinc-500" />
              <span className="text-sm text-zinc-400">Drop PDF here or click to browse</span>
            </>
          )}
          <input type="file" accept=".pdf" className="hidden" onChange={handleChange} />
        </label>
        {uploadMutation.isError && (
          <p className="mt-3 text-sm text-red-400">{uploadMutation.error.message}</p>
        )}
      </div>
    </div>
  )
}
