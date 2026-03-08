import { useCallback, useState } from 'react'
import { useProfile, useUploadResume } from '@/hooks/useJobs'
import { Upload, FileText, Loader2, User, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ResumeUpload() {
  const { data: profile } = useProfile()
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

  if (profile) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="mb-2 flex items-center gap-2">
          <User size={14} className="text-indigo-400" />
          <span className="text-sm font-medium text-zinc-200">{profile.name || 'Profile'}</span>
        </div>
        {profile.title && (
          <div className="mb-1 flex items-center gap-1.5 text-xs text-zinc-400">
            <Briefcase size={12} /> {profile.title}
          </div>
        )}
        {profile.skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {profile.skills.slice(0, 8).map(skill => (
              <span key={skill} className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-400">
                {skill}
              </span>
            ))}
            {profile.skills.length > 8 && (
              <span className="text-[10px] text-zinc-600">+{profile.skills.length - 8}</span>
            )}
          </div>
        )}
        <label className="mt-2 flex cursor-pointer items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400">
          <Upload size={10} /> Re-upload resume
          <input type="file" accept=".pdf" className="hidden" onChange={handleChange} />
        </label>
      </div>
    )
  }

  return (
    <label
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors',
        dragging ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/[0.08] hover:border-white/[0.15]',
        uploadMutation.isPending && 'pointer-events-none opacity-50'
      )}
    >
      {uploadMutation.isPending ? (
        <>
          <Loader2 size={24} className="animate-spin text-indigo-400" />
          <span className="text-sm text-zinc-400">Parsing resume...</span>
        </>
      ) : (
        <>
          <FileText size={24} className="text-zinc-500" />
          <span className="text-sm text-zinc-400">Drop PDF resume here</span>
          <span className="text-xs text-zinc-600">or click to browse</span>
        </>
      )}
      <input type="file" accept=".pdf" className="hidden" onChange={handleChange} />
      {uploadMutation.isError && (
        <p className="text-xs text-red-400">{uploadMutation.error.message}</p>
      )}
    </label>
  )
}
