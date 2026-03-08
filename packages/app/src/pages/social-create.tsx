import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Upload, Sparkles, Loader2, Clock, Send, FileText,
  Instagram, Twitter, Youtube, Check, Trash2, Pencil, X, Plus,
  MapPin, Eye, MessageSquare, Hash, Image as ImageIcon, Tag, Wand2,
  Heart, MessageCircle, Bookmark, Share2, Repeat2, BarChart3, ThumbsUp, ThumbsDown,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settings'
import type { SocialPlatform, SocialPost, SocialMedia, PostVisibility, SocialAccount } from '@zync/shared/types'
import * as socialService from '@/services/social'
import toast from 'react-hot-toast'

const platformOptions: Array<{ id: SocialPlatform; label: string; icon: typeof Instagram }> = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'x', label: 'X / Twitter', icon: Twitter },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
]

const visibilityOptions: Array<{ id: PostVisibility; label: string; desc: string }> = [
  { id: 'public', label: 'Public', desc: 'Visible to everyone' },
  { id: 'private', label: 'Private', desc: 'Only you can see' },
  { id: 'close_friends', label: 'Close Friends', desc: 'Instagram Close Friends only' },
  { id: 'unlisted', label: 'Unlisted', desc: 'Not in feeds, accessible via link' },
]

const toneOptions = [
  { id: 'casual', label: 'Casual' },
  { id: 'funny', label: 'Funny' },
  { id: 'confident', label: 'Confident' },
  { id: 'trendy', label: 'Trendy' },
  { id: 'inspirational', label: 'Inspirational' },
  { id: 'edgy', label: 'Edgy' },
  { id: 'storytelling', label: 'Story' },
  { id: 'professional', label: 'Professional' },
]

const languageOptions = [
  { id: 'Arabic', label: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629' },
  { id: 'English', label: 'English' },
  { id: 'French', label: 'Fran\u00E7ais' },
  { id: 'Spanish', label: 'Espa\u00F1ol' },
  { id: 'German', label: 'Deutsch' },
  { id: 'Portuguese', label: 'Portugu\u00EAs' },
  { id: 'Italian', label: 'Italiano' },
  { id: 'Turkish', label: 'T\u00FCrk\u00E7e' },
  { id: 'Hindi', label: '\u0939\u093F\u0928\u094D\u0926\u0940' },
  { id: 'Japanese', label: '\u65E5\u672C\u8A9E' },
  { id: 'Korean', label: '\uD55C\uAD6D\uC5B4' },
  { id: 'Chinese', label: '\u4E2D\u6587' },
  { id: 'Russian', label: '\u0420\u0443\u0441\u0441\u043A\u0438\u0439' },
  { id: 'Dutch', label: 'Nederlands' },
  { id: 'Hebrew', label: '\u05E2\u05D1\u05E8\u05D9\u05EA' },
]

interface MediaItem {
  file?: File
  localUrl?: string
  uploaded?: SocialMedia
  uploading: boolean
}

function isHeicFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  return ['heic', 'heif'].includes(ext)
}

function getMediaSrc(item: MediaItem): string | null {
  if (item.uploaded) return `/api/social/media/file/${item.uploaded.filename}`
  return item.localUrl || null
}

export function SocialCreate() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { settings } = useSettingsStore()

  const defaultPlatform = (searchParams.get('platform') || 'instagram') as SocialPlatform
  const isEditing = !!id

  const [loading, setLoading] = useState(!!id)
  const [editPost, setEditPost] = useState<SocialPost | null>(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([defaultPlatform])
  const [content, setContent] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [visibility, setVisibility] = useState<PostVisibility>('public')
  const [firstComment, setFirstComment] = useState('')
  const [location, setLocation] = useState('')
  const [altText, setAltText] = useState('')
  const [labels, setLabels] = useState<string[]>([])
  const [labelInput, setLabelInput] = useState('')

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [suggestingTime, setSuggestingTime] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [igProfilePic, setIgProfilePic] = useState<string | null>(null)

  // Account selection
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([])

  // AI generation state
  const [captionBrief, setCaptionBrief] = useState('')
  const [captionTone, setCaptionTone] = useState('casual')
  const [captionLang, setCaptionLang] = useState('')
  const [generatingCaption, setGeneratingCaption] = useState(false)
  const [commentBrief, setCommentBrief] = useState('')
  const [commentTone, setCommentTone] = useState('trendy')
  const [commentLang, setCommentLang] = useState('')
  const [generatingComment, setGeneratingComment] = useState(false)

  useEffect(() => {
    socialService.getInstagramProfile().then((p) => { if (p.profile_picture_url) setIgProfilePic(p.profile_picture_url) }).catch(() => {})
  }, [])

  useEffect(() => {
    socialService.getAccounts().then(setAccounts).catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    socialService.getPost(Number(id))
      .then((post) => {
        setEditPost(post)
        setContent(post.content || '')
        setSelectedPlatforms([post.platform])
        if (post.scheduled_for) {
          const d = new Date(post.scheduled_for)
          const pad = (n: number) => String(n).padStart(2, '0')
          setScheduledFor(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`)
        }
        setVisibility(post.visibility || 'public')
        setFirstComment(post.first_comment || '')
        setLocation(post.location || '')
        setAltText(post.alt_text || '')
        if (post.labels) { try { setLabels(JSON.parse(post.labels)) } catch { /* */ } }
        const rawIds = post.media_ids
        if (rawIds) {
          try {
            const ids: number[] = JSON.parse(rawIds)
            if (ids.length > 0) {
              Promise.all(ids.map((mid) => socialService.getMedia(mid).catch(() => null)))
                .then((results) => {
                  setMediaItems(results.filter((m): m is SocialMedia => m !== null).map((m) => ({ uploaded: m, uploading: false })))
                })
              return
            }
          } catch { /* */ }
        }
        if (post.media_url) setMediaItems([{ localUrl: post.media_url, uploading: false }])
      })
      .catch(() => { toast.error('Post not found'); navigate('/social/dashboard') })
      .finally(() => setLoading(false))
  }, [id, navigate])

  // Pre-fill from trend search
  useEffect(() => {
    const trendParam = searchParams.get('trend')
    if (trendParam && !id) {
      try {
        const decoded = decodeURIComponent(atob(trendParam))
        setContent(decoded)
      } catch { /* ignore malformed */ }
    }
  }, [searchParams, id])

  const togglePlatform = (pid: SocialPlatform) => {
    setSelectedPlatforms((prev) => prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid])
  }

  const uploadFile = useCallback(async (file: File) => {
    const isImage = file.type.startsWith('image/'); const isVideo = file.type.startsWith('video/'); const heic = isHeicFile(file)
    if (!isImage && !isVideo && !heic) { toast.error('Only images and videos are supported'); return }
    const localUrl = heic ? undefined : URL.createObjectURL(file)
    const item: MediaItem = { file, localUrl, uploading: true }
    setMediaItems((prev) => [...prev, item])
    try {
      const uploaded = await socialService.uploadMedia(file)
      setMediaItems((prev) => prev.map((m) => m.file === file ? { uploaded, uploading: false } : m))
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
      setMediaItems((prev) => prev.filter((m) => m.file !== file))
      if (localUrl) URL.revokeObjectURL(localUrl)
    }
  }, [])

  const handleFiles = useCallback((files: FileList | File[]) => { for (const f of Array.from(files)) uploadFile(f) }, [uploadFile])
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files) }, [handleFiles])
  const openFilePicker = useCallback(() => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*,video/*,.heic,.heif'; input.multiple = true
    input.onchange = (e) => { const f = (e.target as HTMLInputElement).files; if (f?.length) handleFiles(f) }; input.click()
  }, [handleFiles])
  const removeMedia = (idx: number) => {
    const item = mediaItems[idx]; if (item.localUrl) URL.revokeObjectURL(item.localUrl)
    setMediaItems((prev) => prev.filter((_, i) => i !== idx))
  }

  // AI Generation
  const handleGenerateCaption = async () => {
    if (!captionBrief.trim()) { toast.error('Describe what you want the caption to say'); return }
    setGeneratingCaption(true)
    try {
      const result = await socialService.generateFromBrief({
        brief: captionBrief, tone: captionTone, platform: selectedPlatforms[0] || 'instagram', target: 'caption',
        ...(captionLang && { language: captionLang }),
      })
      setContent(result.text)
    } catch (err: any) { toast.error(err.message || 'Generation failed') }
    setGeneratingCaption(false)
  }

  const handleGenerateComment = async () => {
    if (!commentBrief.trim()) { toast.error('Describe what the first comment should include'); return }
    setGeneratingComment(true)
    try {
      const result = await socialService.generateFromBrief({
        brief: commentBrief, tone: commentTone, platform: selectedPlatforms[0] || 'instagram',
        existingCaption: content, target: 'first_comment',
        ...(commentLang && { language: commentLang }),
      })
      setFirstComment(result.text)
    } catch (err: any) { toast.error(err.message || 'Generation failed') }
    setGeneratingComment(false)
  }

  const handleSuggestTime = async () => {
    setSuggestingTime(true)
    try {
      const result = await socialService.getOptimalTime(selectedPlatforms[0] || defaultPlatform)
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const targetDay = dayNames.indexOf(result.day); const now = new Date()
      const diff = (targetDay - now.getDay() + 7) % 7 || 7; const next = new Date(now)
      next.setDate(now.getDate() + diff); next.setHours(result.hour, 0, 0, 0)
      const pad = (n: number) => String(n).padStart(2, '0')
      setScheduledFor(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`)
    } catch (err: any) { toast.error(err.message || 'Failed to suggest time') }
    setSuggestingTime(false)
  }

  const handleAddLabel = () => { const tag = labelInput.trim(); if (tag && !labels.includes(tag)) setLabels([...labels, tag]); setLabelInput('') }

  const handleDelete = async () => {
    if (!editPost || !confirm('Delete this post?')) return
    setSaving(true)
    try { await socialService.deletePostApi(editPost.id); toast.success('Post deleted'); navigate('/social/dashboard') }
    catch (err: any) { toast.error(err.message || 'Delete failed') }
    setSaving(false)
  }

  const handleSave = async (action: 'draft' | 'schedule' | 'publish') => {
    if (!content.trim()) { toast.error('Content is required'); return }
    if (selectedPlatforms.length === 0) { toast.error('Select at least one platform'); return }
    if (mediaItems.some((m) => m.uploading)) { toast.error('Wait for uploads to finish'); return }
    setSaving(true)
    try {
      const scheduled = action === 'schedule' && scheduledFor ? scheduledFor : undefined
      const mediaIds = mediaItems.map((m) => m.uploaded?.id).filter((i): i is number => i !== undefined)
      const accountId = selectedAccountIds.length > 0 ? selectedAccountIds[0] : undefined
      let postId: number
      if (isEditing && editPost) {
        postId = editPost.id
        await socialService.updatePost(postId, {
          content, scheduled_for: scheduled ?? null, media_ids: mediaIds.length > 0 ? mediaIds : undefined,
          visibility, first_comment: firstComment || null, location: location || null,
          alt_text: altText || null, labels: labels.length > 0 ? labels : null,
        })
      } else {
        const r = await socialService.createPost({
          platform: selectedPlatforms[0], content, scheduled_for: scheduled, visibility,
          first_comment: firstComment || undefined, location: location || undefined,
          alt_text: altText || undefined, labels: labels.length > 0 ? labels : undefined,
          media_ids: mediaIds.length > 0 ? mediaIds : undefined,
          ...(accountId != null && { account_id: accountId }),
        })
        postId = r.id
      }
      if (action === 'publish') {
        const pr = await socialService.publishPost(postId, selectedPlatforms)
        const ok = pr.results.filter((r) => r.externalId); const fail = pr.results.filter((r) => r.error)
        if (ok.length > 0) toast.success(`Published to ${ok.map((r) => r.platform).join(', ')}`)
        for (const f of fail) toast.error(`${f.platform}: ${f.error}`, { duration: 5000 })
      } else { toast.success(isEditing ? (action === 'schedule' ? 'Schedule updated!' : 'Draft updated!') : (action === 'schedule' ? 'Scheduled!' : 'Draft saved!')) }
      navigate('/social/dashboard')
    } catch (err: any) { toast.error(err.message || 'Save failed') }
    setSaving(false)
  }

  const hasX = selectedPlatforms.includes('x')
  const charLimit = hasX ? 280 : undefined
  const hasVideo = mediaItems.some((m) => m.uploaded?.media_type === 'video')
  const anyUploading = mediaItems.some((m) => m.uploading)
  const previewMediaSrcs = mediaItems.filter((m) => !m.uploading).map((m) => ({
    src: getMediaSrc(m), isVideo: m.uploaded?.media_type === 'video',
  })).filter((m) => m.src !== null) as Array<{ src: string; isVideo: boolean }>

  const igUsername = settings.social.instagram?.username || 'your_account'
  const xUsername = settings.social.x?.username || 'your_handle'
  const ytChannel = settings.social.youtube?.channelHandle || 'Your Channel'

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 size={24} className="animate-spin text-zinc-500" /></div>

  return (
    <div className="max-w-5xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-zinc-100">
          {isEditing ? <><Pencil size={16} className="inline mr-2" />Edit Post</> : 'Create Post'}
        </h1>
        <div className="flex items-center gap-2">
          {isEditing && editPost?.status !== 'published' && (
            <Button size="sm" variant="ghost" onClick={handleDelete} disabled={saving} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10">
              <Trash2 size={14} className="mr-1" />Delete
            </Button>
          )}
          {(!isEditing || editPost?.status !== 'published') && (
            <Button size="sm" variant="ghost" onClick={() => handleSave('draft')} disabled={saving}>
              <FileText size={14} className="mr-1" />{isEditing ? 'Update Draft' : 'Save Draft'}
            </Button>
          )}
          {scheduledFor && (
            <Button size="sm" variant="outline" onClick={() => handleSave('schedule')} disabled={saving}>
              <Clock size={14} className="mr-1" />{isEditing ? 'Update Schedule' : 'Schedule'}
            </Button>
          )}
          {(!isEditing || editPost?.status !== 'published') && (
            <Button size="sm" onClick={() => handleSave('publish')} disabled={saving || !content.trim() || selectedPlatforms.length === 0 || anyUploading}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Send size={14} className="mr-1" />}
              Publish{selectedPlatforms.length > 1 ? ` to ${selectedPlatforms.length}` : ''}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: compose (3/5) */}
        <div className="lg:col-span-3 space-y-5">

          {/* Platforms */}
          <Section title="Platforms" icon={<Hash size={14} />}>
            <div className="flex flex-wrap gap-2">
              {platformOptions.map((p) => {
                const Icon = p.icon; const enabled = settings.social[p.id]?.enabled; const selected = selectedPlatforms.includes(p.id)
                return (
                  <button key={p.id} onClick={() => enabled && togglePlatform(p.id)} disabled={!enabled}
                    className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                      selected ? 'border-indigo-500/40 bg-indigo-500/10 text-zinc-100' : enabled ? 'border-white/[0.06] text-zinc-500 hover:text-zinc-300' : 'border-white/[0.04] text-zinc-700 cursor-not-allowed')}>
                    <Icon size={14} />{p.label}{selected && <Check size={12} className="text-indigo-400" />}
                  </button>
                )
              })}
            </div>
            {hasVideo && selectedPlatforms.includes('instagram') && <p className="text-[10px] text-pink-400 mt-1">Video -- will publish as Instagram Reel</p>}
          </Section>

          {/* Account selection */}
          {selectedPlatforms.length > 0 && accounts.length > 0 && (
            <Section title="Accounts" icon={<Users size={14} />}>
              <div className="flex flex-wrap gap-2">
                {accounts
                  .filter((a) => selectedPlatforms.includes(a.platform as SocialPlatform))
                  .map((a) => {
                    const selected = selectedAccountIds.includes(a.id)
                    return (
                      <button key={a.id}
                        onClick={() => setSelectedAccountIds(prev => selected ? prev.filter(aid => aid !== a.id) : [...prev, a.id])}
                        className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                          selected ? 'border-indigo-500/40 bg-indigo-500/10 text-zinc-100' : 'border-white/[0.06] text-zinc-500 hover:text-zinc-300')}>
                        @{a.username}
                        {selected && <Check size={12} className="text-indigo-400" />}
                      </button>
                    )
                  })}
              </div>
            </Section>
          )}

          {/* Media */}
          <Section title={`Media${mediaItems.length > 0 ? ` (${mediaItems.length})` : ''}`} icon={<ImageIcon size={14} />}>
            {mediaItems.length === 0 ? (
              <div onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={openFilePicker}
                className={cn('flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors',
                  dragOver ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/[0.08] hover:border-white/[0.15]')}>
                <Upload size={28} className="text-zinc-500 mb-2" />
                <p className="text-sm text-zinc-400">Drop images or videos, or click to browse</p>
                <p className="text-xs text-zinc-600 mt-1">JPG, PNG, HEIC, MP4, MOV -- multiple files</p>
              </div>
            ) : (
              <div onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
                className={cn(dragOver && 'ring-2 ring-indigo-500/30 rounded-xl')}>
                <div className={cn('grid gap-2', mediaItems.length === 1 ? 'grid-cols-1' : 'grid-cols-2', mediaItems.length > 4 && 'grid-cols-3')}>
                  {mediaItems.map((item, idx) => (
                    <MediaThumb key={idx} item={item} onRemove={() => removeMedia(idx)} single={mediaItems.length === 1} />
                  ))}
                  <button onClick={openFilePicker}
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/[0.08] hover:border-white/[0.15] min-h-[120px] cursor-pointer">
                    <Plus size={20} className="text-zinc-500 mb-1" /><span className="text-[10px] text-zinc-500">Add more</span>
                  </button>
                </div>
              </div>
            )}
            {mediaItems.length > 0 && (
              <div className="mt-3">
                <label className="block text-xs text-zinc-500 mb-1"><ImageIcon size={10} className="inline mr-1" />Alt text</label>
                <input value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Describe for accessibility..."
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/30 focus:outline-none" />
              </div>
            )}
          </Section>

          {/* Caption with AI */}
          <Section title="Caption" icon={<MessageSquare size={14} />}>
            {/* AI Generation Bar */}
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 mb-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 mb-2">
                <Wand2 size={12} />AI Caption Generator
              </div>
              <input value={captionBrief} onChange={(e) => setCaptionBrief(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerateCaption() } }}
                placeholder="What is the post about? e.g. 'sunset beach vibes with friends' or 'new product launch'"
                className="w-full rounded-lg border border-indigo-500/20 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none mb-2" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1 items-center">
                  {toneOptions.map((t) => (
                    <button key={t.id} onClick={() => setCaptionTone(t.id)}
                      className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
                        captionTone === t.id ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30' : 'bg-white/[0.04] text-zinc-500 hover:text-zinc-300')}>
                      {t.label}
                    </button>
                  ))}
                  <select value={captionLang} onChange={(e) => setCaptionLang(e.target.value)}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-white/[0.04] text-zinc-400 border border-white/[0.08] focus:outline-none focus:border-indigo-500/30 cursor-pointer">
                    <option value="">Language</option>
                    {languageOptions.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </div>
                <Button size="sm" onClick={handleGenerateCaption} disabled={generatingCaption || !captionBrief.trim()} className="flex-shrink-0">
                  {generatingCaption ? <Loader2 size={12} className="animate-spin mr-1" /> : <Sparkles size={12} className="mr-1" />}
                  Generate
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end mb-1">
              {charLimit && <span className={cn('text-xs', content.length > charLimit ? 'text-rose-400' : 'text-zinc-500')}>{content.length}/{charLimit}</span>}
            </div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your caption or use AI above..." rows={6}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/30 focus:outline-none resize-none" />
          </Section>

          {/* First Comment with AI */}
          <Section title="First Comment" icon={<MessageSquare size={14} />} subtitle="Auto-post as first comment -- great for extra hashtags">
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 mb-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 mb-2">
                <Wand2 size={12} />AI First Comment
              </div>
              <input value={commentBrief} onChange={(e) => setCommentBrief(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerateComment() } }}
                placeholder="What should the first comment say? e.g. 'trending fitness hashtags' or 'ask a travel question'"
                className="w-full rounded-lg border border-indigo-500/20 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none mb-2" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1 items-center">
                  {toneOptions.map((t) => (
                    <button key={t.id} onClick={() => setCommentTone(t.id)}
                      className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
                        commentTone === t.id ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30' : 'bg-white/[0.04] text-zinc-500 hover:text-zinc-300')}>
                      {t.label}
                    </button>
                  ))}
                  <select value={commentLang} onChange={(e) => setCommentLang(e.target.value)}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-white/[0.04] text-zinc-400 border border-white/[0.08] focus:outline-none focus:border-indigo-500/30 cursor-pointer">
                    <option value="">Language</option>
                    {languageOptions.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </div>
                <Button size="sm" onClick={handleGenerateComment} disabled={generatingComment || !commentBrief.trim()} className="flex-shrink-0">
                  {generatingComment ? <Loader2 size={12} className="animate-spin mr-1" /> : <Sparkles size={12} className="mr-1" />}
                  Generate
                </Button>
              </div>
            </div>
            <textarea value={firstComment} onChange={(e) => setFirstComment(e.target.value)}
              placeholder="Write or generate your first comment..." rows={3}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/30 focus:outline-none resize-none" />
          </Section>

          {/* Settings row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Section title="Visibility" icon={<Eye size={14} />}>
              <div className="space-y-1.5">
                {visibilityOptions.map((opt) => (
                  <label key={opt.id} className={cn('flex items-start gap-2 rounded-lg border p-2 cursor-pointer transition-colors',
                    visibility === opt.id ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-white/[0.06] hover:border-white/[0.12]')}>
                    <input type="radio" name="visibility" value={opt.id} checked={visibility === opt.id}
                      onChange={() => setVisibility(opt.id)} className="mt-0.5 accent-indigo-500" />
                    <div><p className="text-xs font-medium text-zinc-200">{opt.label}</p><p className="text-[10px] text-zinc-500">{opt.desc}</p></div>
                  </label>
                ))}
              </div>
            </Section>
            <div className="space-y-4">
              <Section title="Schedule" icon={<Clock size={14} />}>
                <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500/30 focus:outline-none" />
                <Button size="sm" variant="ghost" onClick={handleSuggestTime} disabled={suggestingTime} className="mt-2 w-full">
                  {suggestingTime ? <Loader2 size={12} className="animate-spin mr-1" /> : <Clock size={12} className="mr-1" />}Suggest best time
                </Button>
                {scheduledFor && <button onClick={() => setScheduledFor('')} className="text-[10px] text-zinc-500 hover:text-zinc-300 mt-1">Clear</button>}
              </Section>
              <Section title="Location" icon={<MapPin size={14} />}>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add location..."
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/30 focus:outline-none" />
              </Section>
            </div>
          </div>

          {/* Labels */}
          <Section title="Labels" icon={<Tag size={14} />}>
            <div className="flex gap-1.5">
              <input value={labelInput} onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLabel() } }} placeholder="Add label..."
                className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/30 focus:outline-none" />
              <Button size="sm" variant="outline" onClick={handleAddLabel} disabled={!labelInput.trim()}>Add</Button>
            </div>
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {labels.map((label, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] pl-2 pr-1 py-0.5 text-[10px] text-zinc-300">
                    {label}<button onClick={() => setLabels(labels.filter((_, j) => j !== i))} className="rounded-full p-0.5 hover:bg-white/[0.1]"><X size={8} /></button>
                  </span>
                ))}
              </div>
            )}
          </Section>

          {isEditing && editPost && (
            <Section title="Post Info" icon={<FileText size={14} />}>
              <div className="space-y-1.5 text-xs text-zinc-500">
                <p>Status: <span className="text-zinc-300 capitalize">{editPost.status}</span></p>
                <p>Created: <span className="text-zinc-300">{new Date(editPost.created_at).toLocaleString()}</span></p>
                {editPost.posted_at && <p>Published: <span className="text-zinc-300">{new Date(editPost.posted_at).toLocaleString()}</span></p>}
                {editPost.permalink && <a href={editPost.permalink} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">View on {editPost.platform}</a>}
              </div>
            </Section>
          )}
        </div>

        {/* Right: Live Previews (2/5) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-1"><Eye size={14} />Live Preview</div>

          {selectedPlatforms.length === 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-xs text-zinc-600">Select a platform to see preview</div>
          )}
          {selectedPlatforms.includes('instagram') && <InstagramPreview username={igUsername} content={content} media={previewMediaSrcs} location={location} hasVideo={hasVideo} profilePic={igProfilePic} />}
          {selectedPlatforms.includes('x') && <XPreview username={xUsername} content={content} media={previewMediaSrcs} />}
          {selectedPlatforms.includes('youtube') && <YouTubePreview channel={ytChannel} content={content} media={previewMediaSrcs} hasVideo={hasVideo} />}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Platform Previews
// ============================================================

function InstagramPreview({ username, content, media, location, hasVideo, profilePic }: {
  username: string; content: string; media: Array<{ src: string; isVideo: boolean }>; location: string; hasVideo: boolean; profilePic?: string | null
}) {
  const [slide, setSlide] = useState(0)
  const captionLines = content.split('\n'); const displayCaption = captionLines.slice(0, 3).join('\n'); const truncated = captionLines.length > 3
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="px-3 py-1.5 flex items-center gap-0.5 bg-gradient-to-r from-pink-500/5 to-purple-500/5 border-b border-white/[0.04]">
        <Instagram size={12} className="text-pink-400" /><span className="text-[10px] font-medium text-pink-400">Instagram</span>
        {hasVideo && <span className="text-[10px] text-pink-300 ml-auto">Reel</span>}
        {media.length > 1 && <span className="text-[10px] text-pink-300 ml-auto">Carousel</span>}
      </div>
      <div className="flex items-center gap-2.5 px-3 py-2">
        {profilePic
          ? <img src={profilePic} alt="" className="h-8 w-8 rounded-full object-cover" />
          : <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">{username[0]?.toUpperCase()}</div>
        }
        <div><p className="text-xs font-semibold text-zinc-200">{username}</p>{location && <p className="text-[10px] text-zinc-500">{location}</p>}</div>
      </div>
      {media.length > 0 ? (
        <div className="relative bg-black aspect-square">
          {media[slide]?.isVideo ? <video src={media[slide].src} className="w-full h-full object-contain" /> : <img src={media[slide].src} alt="" className="w-full h-full object-contain" />}
          {media.length > 1 && (<>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">{media.map((_, i) => (<button key={i} onClick={() => setSlide(i)} className={cn('h-1.5 rounded-full transition-all', i === slide ? 'w-4 bg-blue-400' : 'w-1.5 bg-white/40')} />))}</div>
            {slide > 0 && <button onClick={() => setSlide(slide - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/50 flex items-center justify-center text-white text-xs">&lt;</button>}
            {slide < media.length - 1 && <button onClick={() => setSlide(slide + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/50 flex items-center justify-center text-white text-xs">&gt;</button>}
          </>)}
        </div>
      ) : <div className="aspect-square bg-zinc-800 flex items-center justify-center"><ImageIcon size={32} className="text-zinc-700" /></div>}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4"><Heart size={18} className="text-zinc-400" /><MessageCircle size={18} className="text-zinc-400" /><Send size={18} className="text-zinc-400" /></div>
        <Bookmark size={18} className="text-zinc-400" />
      </div>
      <div className="px-3 pb-3">
        <p className="text-xs text-zinc-500 mb-1">0 likes</p>
        {content ? <p className="text-xs text-zinc-300"><span className="font-semibold text-zinc-200">{username}</span>{' '}<span className="whitespace-pre-wrap">{displayCaption}</span>{truncated && <span className="text-zinc-500"> ...more</span>}</p>
          : <p className="text-xs text-zinc-600 italic">No caption yet</p>}
      </div>
    </div>
  )
}

function XPreview({ username, content, media }: { username: string; content: string; media: Array<{ src: string; isVideo: boolean }> }) {
  const displayName = username.replace(/^@/, ''); const handle = `@${displayName}`
  const truncated = content.length > 280 ? content.slice(0, 277) + '...' : content
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="px-3 py-1.5 flex items-center gap-0.5 bg-gradient-to-r from-sky-500/5 to-blue-500/5 border-b border-white/[0.04]">
        <Twitter size={12} className="text-sky-400" /><span className="text-[10px] font-medium text-sky-400">X / Twitter</span>
      </div>
      <div className="p-3"><div className="flex gap-2.5">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white">{displayName[0]?.toUpperCase()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1"><span className="text-xs font-semibold text-zinc-200">{displayName}</span><span className="text-xs text-zinc-500">{handle}</span><span className="text-xs text-zinc-600">· now</span></div>
          {content ? <p className="text-sm text-zinc-300 mt-1 whitespace-pre-wrap break-words">{truncated}</p> : <p className="text-sm text-zinc-600 italic mt-1">No content yet</p>}
          {media.length > 0 && (
            <div className={cn('mt-2 rounded-xl overflow-hidden border border-white/[0.08]', media.length > 1 && 'grid grid-cols-2 gap-0.5')}>
              {media.slice(0, 4).map((m, i) => m.isVideo ? <video key={i} src={m.src} className={cn('w-full object-cover bg-black', media.length === 1 ? 'max-h-64' : 'h-32')} /> : <img key={i} src={m.src} alt="" className={cn('w-full object-cover bg-black', media.length === 1 ? 'max-h-64' : 'h-32')} />)}
            </div>
          )}
          <div className="flex items-center justify-between mt-2.5 max-w-[280px]">
            <span className="flex items-center gap-1 text-zinc-500"><MessageCircle size={14} /><span className="text-xs">0</span></span>
            <span className="flex items-center gap-1 text-zinc-500"><Repeat2 size={14} /><span className="text-xs">0</span></span>
            <span className="flex items-center gap-1 text-zinc-500"><Heart size={14} /><span className="text-xs">0</span></span>
            <span className="flex items-center gap-1 text-zinc-500"><BarChart3 size={14} /><span className="text-xs">0</span></span>
            <span className="text-zinc-500"><Share2 size={14} /></span>
          </div>
        </div>
      </div></div>
    </div>
  )
}

function YouTubePreview({ channel, content, media, hasVideo }: { channel: string; content: string; media: Array<{ src: string; isVideo: boolean }>; hasVideo: boolean }) {
  const firstMedia = media[0]; const title = content.split('\n')[0] || 'Untitled'; const description = content.split('\n').slice(1).join('\n').trim()
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="px-3 py-1.5 flex items-center gap-0.5 bg-gradient-to-r from-red-500/5 to-red-700/5 border-b border-white/[0.04]">
        <Youtube size={12} className="text-red-400" /><span className="text-[10px] font-medium text-red-400">YouTube</span>
        <span className="text-[10px] text-red-300 ml-auto">{hasVideo ? 'Video' : 'Post'}</span>
      </div>
      <div className="relative aspect-video bg-zinc-800">
        {firstMedia ? (firstMedia.isVideo ? <video src={firstMedia.src} className="w-full h-full object-contain bg-black" /> : <img src={firstMedia.src} alt="" className="w-full h-full object-contain bg-black" />)
          : <div className="w-full h-full flex items-center justify-center"><Youtube size={40} className="text-zinc-700" /></div>}
        {hasVideo && <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white font-medium">0:00</div>}
      </div>
      <div className="p-3">
        <div className="flex gap-2.5">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white">{channel[0]?.toUpperCase()}</div>
          <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-zinc-200 line-clamp-2">{title}</p><p className="text-xs text-zinc-500 mt-0.5">{channel}</p><p className="text-xs text-zinc-600">0 views · Just now</p></div>
        </div>
        {description && <p className="text-xs text-zinc-500 mt-2 line-clamp-2 whitespace-pre-wrap">{description}</p>}
        <div className="flex items-center gap-3 mt-3 pt-2 border-t border-white/[0.04]">
          <span className="flex items-center gap-1 text-zinc-500"><ThumbsUp size={14} /><span className="text-xs">0</span></span>
          <span className="text-zinc-500"><ThumbsDown size={14} /></span>
          <span className="flex items-center gap-1 text-zinc-500"><Share2 size={14} /><span className="text-xs">Share</span></span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Shared components
// ============================================================

function MediaThumb({ item, onRemove, single }: { item: MediaItem; onRemove: () => void; single: boolean }) {
  const [imgError, setImgError] = useState(false)
  const isVideo = item.uploaded?.media_type === 'video'; const previewSrc = getMediaSrc(item)
  return (
    <div className={cn('relative rounded-xl overflow-hidden border border-white/[0.08] bg-zinc-800', single && 'col-span-full')}>
      {item.uploading ? (
        <div className="flex flex-col items-center justify-center h-48 bg-zinc-800">
          <Loader2 size={24} className="animate-spin text-indigo-400 mb-2" />
          <p className="text-xs text-zinc-400">{item.file && isHeicFile(item.file) ? 'Converting HEIC...' : 'Uploading...'}</p>
          <p className="text-[10px] text-zinc-600 mt-1">{item.file?.name}</p>
        </div>
      ) : isVideo && previewSrc ? (
        <video src={previewSrc} controls className={cn('w-full object-contain bg-black', single ? 'max-h-80' : 'h-48')} />
      ) : previewSrc && !imgError ? (
        <img src={previewSrc} alt="" className={cn('w-full bg-black', single ? 'max-h-80 object-contain' : 'h-48 object-cover')} onError={() => setImgError(true)} />
      ) : (
        <div className="flex flex-col items-center justify-center h-48 bg-zinc-800">
          <ImageIcon size={18} className="text-zinc-500 mb-1" /><p className="text-xs text-zinc-400">{item.uploaded?.original_name || item.file?.name || 'Media'}</p>
        </div>
      )}
      {!item.uploading && (
        <div className="absolute top-1.5 right-1.5">
          <button onClick={onRemove} className="rounded-lg bg-zinc-900/80 backdrop-blur px-1.5 py-1 text-zinc-300 hover:bg-zinc-800 shadow-lg"><X size={12} /></button>
        </div>
      )}
      {item.uploading && <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700"><div className="h-full bg-indigo-500 animate-pulse" style={{ width: '60%' }} /></div>}
    </div>
  )
}

function Section({ title, icon, subtitle, children, borderColor, bgColor }: {
  title: string; icon: React.ReactNode; subtitle?: string; children: React.ReactNode; borderColor?: string; bgColor?: string
}) {
  return (
    <div className={cn('rounded-xl border p-4', borderColor || 'border-white/[0.06]', bgColor || 'bg-white/[0.02]')}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-3">{icon}{title}</div>
      {subtitle && <p className="text-[10px] text-zinc-600 -mt-2 mb-3">{subtitle}</p>}
      {children}
    </div>
  )
}
