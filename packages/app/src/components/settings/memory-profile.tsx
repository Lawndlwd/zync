import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { User, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useProfile, useUpdateProfile } from '@/hooks/useMemory'

const SECTIONS = [
  { key: 'identity', label: 'Identity', hint: 'Name, job title, company, projects...' },
  { key: 'technical', label: 'Technical', hint: 'Languages, frameworks, tools, preferences...' },
  { key: 'interests', label: 'Interests', hint: 'Hobbies, topics you follow, content you consume...' },
  { key: 'communication', label: 'Communication', hint: 'Tone, formality, how you like to be spoken to...' },
  { key: 'work_patterns', label: 'Work Patterns', hint: 'Schedule, workflow, priorities, habits...' },
] as const

export function MemoryProfileTab() {
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()
  const [edits, setEdits] = useState<Record<string, string>>({})

  const getContent = (section: string) => {
    if (section in edits) return edits[section]
    const entry = profile?.find((p) => p.section === section)
    return entry?.content ?? ''
  }

  const getUpdatedAt = (section: string) => {
    const entry = profile?.find((p) => p.section === section)
    return entry?.updated_at ?? null
  }

  const hasEdit = (section: string) => {
    if (!(section in edits)) return false
    const entry = profile?.find((p) => p.section === section)
    return edits[section] !== (entry?.content ?? '')
  }

  const handleChange = (section: string, value: string) => {
    setEdits((prev) => ({ ...prev, [section]: value }))
  }

  const handleSave = (section: string) => {
    const content = edits[section]
    if (content === undefined) return
    updateProfile.mutate(
      { section, content },
      {
        onSuccess: () => {
          setEdits((prev) => {
            const next = { ...prev }
            delete next[section]
            return next
          })
          toast.success(`${section} updated`)
        },
        onError: (err: Error) => {
          toast.error(err.message)
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
        Loading profile...
      </div>
    )
  }

  return (
    <Card className="border-white/[0.08] bg-white/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <User size={16} />
          Core Profile
        </CardTitle>
        <p className="text-xs text-zinc-500">
          Tell the AI about yourself so it can personalize responses.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {SECTIONS.map(({ key, label, hint }) => {
          const updatedAt = getUpdatedAt(key)
          const edited = hasEdit(key)

          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400">{label}</label>
                <div className="flex items-center gap-2">
                  {updatedAt && (
                    <span className="text-[10px] text-zinc-600">
                      Last updated{' '}
                      {new Date(updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                  {edited && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200"
                      onClick={() => handleSave(key)}
                      disabled={updateProfile.isPending}
                    >
                      <Save size={12} className="mr-1" />
                      Save
                    </Button>
                  )}
                </div>
              </div>
              <Textarea
                value={getContent(key)}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={hint}
                rows={3}
                className="resize-none border-white/[0.08] bg-white/[0.03] text-sm text-zinc-300 placeholder:text-zinc-600"
              />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
