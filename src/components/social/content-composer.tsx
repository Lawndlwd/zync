import { useState, useCallback, useEffect } from 'react'
import { X, Upload, Sparkles, Loader2, Clock, Send, FileText, Instagram, Twitter, Youtube, Check, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settings'
import type { SocialPlatform, SocialPost, MediaAnalysis, SocialMedia } from '@/types/social'
import * as socialService from '@/services/social'
import toast from 'react-hot-toast'

const platformOptions: Array<{ id: SocialPlatform; label: string; icon: typeof Instagram; gradient: string }> = [
  { id: 'instagram', label: 'Instagram', icon: Instagram, gradient: 'from-pink-500 to-purple-600' },
  { id: 'x', label: 'X', icon: Twitter, gradient: 'from-sky-400 to-blue-600' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, gradient: 'from-red-500 to-red-700' },
]

interface ContentComposerProps {
  platform: SocialPlatform
  editPost?: SocialPost | null
  onClose: () => void
  onCreated: () => void
}

export function ContentComposer({ platform, editPost, onClose, onCreated }: ContentComposerProps) {
  const { settings } = useSettingsStore()
  const isEditing = !!editPost
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(
    editPost ? [editPost.platform] : [platform]
  )
  const [content, setContent] = useState(editPost?.content || '')
  const [scheduledFor, setScheduledFor] = useState(editPost?.scheduled_for || '')
  const [media, setMedia] = useState<SocialMedia | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<MediaAnalysis | null>(null)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [generatingCaption, setGeneratingCaption] = useState(false)
  const [suggestingTime, setSuggestingTime] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // Load attached media when editing a post
  useEffect(() => {
    if (!editPost) return
    // Try media_ids first (local uploads)
    const rawIds = editPost.media_ids
    if (rawIds) {
      try {
        const ids: number[] = JSON.parse(rawIds)
        if (ids.length > 0) {
          socialService.getMedia(ids[0]).then(setMedia).catch(() => {})
          return
        }
      } catch { /* not valid JSON */ }
    }
    // Fallback: if post has a media_url (synced from Instagram), show it as preview
    if (editPost.media_url) {
      setLocalPreviewUrl(editPost.media_url)
    }
  }, [editPost])

  const togglePlatform = (id: SocialPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const handleFile = useCallback(async (file: File) => {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    // HEIC files on iOS may come as empty mimetype or application/octet-stream
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const isHeic = ['heic', 'heif'].includes(ext)

    if (!isImage && !isVideo && !isHeic) {
      toast.error('Only images and videos are supported')
      return
    }

    // Create a local preview URL immediately (works for jpg/png/mp4/webm, won't work for HEIC)
    const previewUrl = URL.createObjectURL(file)
    setLocalPreviewUrl(previewUrl)
    setMedia(null)
    setAnalysis(null)

    setUploading(true)
    try {
      const uploaded = await socialService.uploadMedia(file)
      setMedia(uploaded)
      // Once uploaded, use server URL (which has HEIC→JPEG conversion)
      setLocalPreviewUrl(null)
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
      setLocalPreviewUrl(null)
    }
    setUploading(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleAnalyze = async () => {
    if (!media) return
    setAnalyzing(true)
    try {
      const result = await socialService.analyzeMedia(media.id)
      setAnalysis(result)
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed')
    }
    setAnalyzing(false)
  }

  const handleGenerateCaption = async () => {
    if (!analysis) return
    setGeneratingCaption(true)
    try {
      const result = await socialService.generateCaption(analysis)
      setContent(result.caption + '\n\n' + result.hashtags.join(' '))
    } catch (err: any) {
      toast.error(err.message || 'Caption generation failed')
    }
    setGeneratingCaption(false)
  }

  const handleSuggestTime = async () => {
    setSuggestingTime(true)
    try {
      const result = await socialService.getOptimalTime(selectedPlatforms[0] || platform)
      // Find next occurrence of the suggested day/hour
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const targetDay = dayNames.indexOf(result.day)
      const now = new Date()
      const diff = (targetDay - now.getDay() + 7) % 7 || 7 // at least 1 day ahead
      const next = new Date(now)
      next.setDate(now.getDate() + diff)
      next.setHours(result.hour, 0, 0, 0)
      // Format as datetime-local value
      const pad = (n: number) => String(n).padStart(2, '0')
      const val = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`
      setScheduledFor(val)
    } catch (err: any) {
      toast.error(err.message || 'Failed to suggest time')
    }
    setSuggestingTime(false)
  }

  const handleDelete = async () => {
    if (!editPost) return
    setSaving(true)
    try {
      await socialService.deletePostApi(editPost.id)
      toast.success('Post deleted')
      onCreated()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Delete failed')
    }
    setSaving(false)
  }

  const handleSave = async (action: 'draft' | 'schedule' | 'publish') => {
    if (!content.trim()) {
      toast.error('Content is required')
      return
    }
    if (selectedPlatforms.length === 0) {
      toast.error('Select at least one platform')
      return
    }
    setSaving(true)
    try {
      const scheduled = action === 'schedule' && scheduledFor ? scheduledFor : undefined
      const mediaIds = media ? [media.id] : undefined

      let postId: number

      if (isEditing) {
        // Update existing post
        postId = editPost!.id
        await socialService.updatePost(postId, {
          content,
          scheduled_for: scheduled ?? null,
          media_ids: mediaIds,
        })
      } else {
        // Create new post
        const primaryPlatform = selectedPlatforms[0]
        const result = await socialService.createPost({
          platform: primaryPlatform,
          content,
          scheduled_for: scheduled,
        })
        postId = result.id

        // Attach media if any
        if (mediaIds) {
          await socialService.updatePost(postId, { media_ids: mediaIds })
        }
      }

      if (action === 'publish') {
        const publishResult = await socialService.publishPost(postId, selectedPlatforms)
        const succeeded = publishResult.results.filter((r) => r.externalId)
        const failed = publishResult.results.filter((r) => r.error)

        if (succeeded.length > 0) {
          toast.success(`Published to ${succeeded.map((r) => r.platform).join(', ')}`)
        }
        for (const f of failed) {
          toast.error(`${f.platform}: ${f.error}`, { duration: 5000 })
        }
      } else if (action === 'schedule') {
        toast.success(isEditing ? 'Schedule updated!' : 'Scheduled!')
      } else {
        toast.success(isEditing ? 'Draft updated!' : 'Draft saved!')
      }
      onCreated()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Save failed')
    }
    setSaving(false)
  }

  // Show char limit if X is selected
  const hasX = selectedPlatforms.includes('x')
  const charLimit = hasX ? 280 : undefined
  const isVideo = media?.media_type === 'video'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-zinc-900/95 backdrop-blur px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">
            {isEditing ? <><Pencil size={14} className="inline mr-1.5" />Edit Post</> : 'New Post'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Platform selector — multi-select */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Publish to</label>
            <div className="flex gap-2">
              {platformOptions.map((p) => {
                const Icon = p.icon
                const enabled = settings.social[p.id]?.enabled
                const selected = selectedPlatforms.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => enabled && togglePlatform(p.id)}
                    disabled={!enabled}
                    className={cn(
                      'relative flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                      selected
                        ? 'border-indigo-500/40 bg-indigo-500/10 text-zinc-100'
                        : enabled
                          ? 'border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12]'
                          : 'border-white/[0.04] text-zinc-700 cursor-not-allowed'
                    )}
                  >
                    <Icon size={14} />
                    {p.label}
                    {selected && (
                      <Check size={12} className="text-indigo-400" />
                    )}
                  </button>
                )
              })}
            </div>
            {selectedPlatforms.length > 1 && (
              <p className="text-[10px] text-indigo-400 mt-1.5">
                Will publish to {selectedPlatforms.length} platforms simultaneously
              </p>
            )}
            {isVideo && selectedPlatforms.includes('instagram') && (
              <p className="text-[10px] text-pink-400 mt-1">
                Video detected — will publish as Instagram Reel
              </p>
            )}
          </div>

          {/* Media Upload */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Media</label>
            <MediaPreview
              media={media}
              localPreviewUrl={localPreviewUrl}
              uploading={uploading}
              analyzing={analyzing}
              dragOver={dragOver}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onBrowse={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/*,video/*,.heic,.heif'
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (file) handleFile(file)
                }
                input.click()
              }}
              onAnalyze={handleAnalyze}
              onRemove={() => {
                if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl)
                setLocalPreviewUrl(null)
                setMedia(null)
                setAnalysis(null)
              }}
            />
          </div>

          {/* AI Analysis Results */}
          {analysis && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-indigo-400">
                <Sparkles size={14} />
                AI Analysis
              </div>
              <div className="space-y-2 text-xs text-zinc-300">
                <p><span className="text-zinc-500">Composition:</span> {analysis.composition}</p>
                <p><span className="text-zinc-500">Mood:</span> {analysis.mood}</p>
                {analysis.filterSuggestions.length > 0 && (
                  <p><span className="text-zinc-500">Filters:</span> {analysis.filterSuggestions.join(', ')}</p>
                )}
                {analysis.keyMoments && analysis.keyMoments.length > 0 && (
                  <p><span className="text-zinc-500">Key moments:</span> {analysis.keyMoments.join(', ')}</p>
                )}
                {analysis.trimSuggestions && (
                  <p><span className="text-zinc-500">Trim tips:</span> {analysis.trimSuggestions}</p>
                )}
              </div>

              {/* Caption ideas - click to insert */}
              {analysis.captionIdeas.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 mb-1.5">Caption ideas (click to use):</p>
                  <div className="space-y-1">
                    {analysis.captionIdeas.map((idea, i) => (
                      <button
                        key={i}
                        onClick={() => setContent(idea)}
                        className="block w-full text-left rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.08] transition-colors"
                      >
                        {idea}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Hashtag chips */}
              {analysis.hashtags.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 mb-1.5">Hashtags (click to add):</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.hashtags.map((tag, i) => (
                      <button
                        key={i}
                        onClick={() => setContent((prev) => prev + ' ' + tag)}
                        className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-white/[0.1] hover:text-zinc-200 transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button size="sm" variant="outline" onClick={handleGenerateCaption} disabled={generatingCaption}>
                {generatingCaption ? <Loader2 size={12} className="animate-spin mr-1" /> : <Sparkles size={12} className="mr-1" />}
                Generate full caption
              </Button>
            </div>
          )}

          {/* Caption Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-400">Caption</label>
              {charLimit && (
                <span className={cn('text-xs', content.length > charLimit ? 'text-rose-400' : 'text-zinc-500')}>
                  {content.length}/{charLimit}
                </span>
              )}
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your caption..."
              rows={5}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/30 focus:outline-none resize-none"
            />
          </div>

          {/* Schedule */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Schedule</label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200 focus:border-indigo-500/30 focus:outline-none"
              />
            </div>
            <div className="pt-5">
              <Button size="sm" variant="ghost" onClick={handleSuggestTime} disabled={suggestingTime}>
                {suggestingTime ? <Loader2 size={12} className="animate-spin mr-1" /> : <Clock size={12} className="mr-1" />}
                Suggest best time
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
            <div>
              {isEditing && editPost!.status !== 'published' && (
                <Button size="sm" variant="ghost" onClick={handleDelete} disabled={saving}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                >
                  <Trash2 size={14} className="mr-1" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(!isEditing || editPost!.status !== 'published') && (
                <Button size="sm" variant="ghost" onClick={() => handleSave('draft')} disabled={saving}>
                  <FileText size={14} className="mr-1" />
                  {isEditing ? 'Update Draft' : 'Save Draft'}
                </Button>
              )}
              {scheduledFor && (
                <Button size="sm" variant="outline" onClick={() => handleSave('schedule')} disabled={saving}>
                  <Clock size={14} className="mr-1" />
                  {isEditing ? 'Update Schedule' : 'Schedule'}
                </Button>
              )}
              {(!isEditing || editPost!.status !== 'published') && (
                <Button size="sm" onClick={() => handleSave('publish')} disabled={saving || !content.trim() || selectedPlatforms.length === 0}>
                  {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Send size={14} className="mr-1" />}
                  Publish{selectedPlatforms.length > 1 ? ` to ${selectedPlatforms.length}` : ''}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Media preview sub-component ---

function MediaPreview({
  media,
  localPreviewUrl,
  uploading,
  analyzing,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onBrowse,
  onAnalyze,
  onRemove,
}: {
  media: SocialMedia | null
  localPreviewUrl: string | null
  uploading: boolean
  analyzing: boolean
  dragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onBrowse: () => void
  onAnalyze: () => void
  onRemove: () => void
}) {
  const [imgError, setImgError] = useState(false)

  const hasPreview = media || localPreviewUrl
  const isVideo = media?.media_type === 'video'

  // Determine the best preview src:
  // 1. Server URL (after upload + HEIC conversion) — most reliable
  // 2. Local object URL (instant preview while uploading, but won't work for HEIC in browser)
  const serverSrc = media ? `/api/social/media/file/${media.filename}` : null
  const previewSrc = serverSrc || localPreviewUrl

  if (!hasPreview) {
    return (
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onBrowse}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer',
          dragOver ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/[0.08] hover:border-white/[0.15]'
        )}
      >
        {uploading ? (
          <Loader2 size={24} className="animate-spin text-zinc-500" />
        ) : (
          <>
            <Upload size={24} className="text-zinc-500 mb-2" />
            <p className="text-xs text-zinc-500">Drop image or video here, or click to browse</p>
            <p className="text-[10px] text-zinc-600 mt-1">Supports JPG, PNG, HEIC, MP4, MOV</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-zinc-800">
      {/* Preview content */}
      {isVideo && previewSrc ? (
        <video
          src={previewSrc}
          controls
          className="w-full max-h-72 object-contain bg-black"
        />
      ) : previewSrc && !imgError ? (
        <img
          src={previewSrc}
          alt=""
          className="w-full max-h-72 object-contain bg-black"
          onError={() => setImgError(true)}
        />
      ) : (
        /* Fallback when image can't render (e.g. HEIC still uploading) */
        <div className="flex flex-col items-center justify-center h-48 bg-zinc-800">
          {uploading ? (
            <>
              <Loader2 size={28} className="animate-spin text-indigo-400 mb-2" />
              <p className="text-xs text-zinc-400">Converting & uploading...</p>
            </>
          ) : (
            <>
              <div className="h-12 w-12 rounded-xl bg-zinc-700 flex items-center justify-center mb-2">
                <Upload size={20} className="text-zinc-400" />
              </div>
              <p className="text-xs text-zinc-400">{media?.original_name || 'Processing...'}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">
                {media ? `${(media.size_bytes / 1024).toFixed(0)} KB` : ''}
              </p>
            </>
          )}
        </div>
      )}

      {/* Overlay buttons */}
      {!uploading && (
        <div className="absolute top-2 right-2 flex gap-1.5">
          {media && (
            <button
              onClick={onAnalyze}
              disabled={analyzing}
              className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-lg"
            >
              {analyzing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <><Sparkles size={12} className="inline mr-1" />Analyze</>
              )}
            </button>
          )}
          <button
            onClick={onRemove}
            className="rounded-lg bg-zinc-900/80 backdrop-blur px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors shadow-lg"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Upload progress indicator */}
      {uploading && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700">
          <div className="h-full bg-indigo-500 animate-pulse" style={{ width: '60%' }} />
        </div>
      )}
    </div>
  )
}
