import { useState, useRef, useCallback } from 'react'
import { MilkdownEditor } from '@/components/ui/milkdown-editor'
import { profileToMarkdown, markdownToProfile } from './profile-markdown'
import type { Profile } from '@zync/shared/types'

interface ProfileEditorProps {
  profile: Profile
  onChange: (updates: Partial<Profile>) => void
}

export function ProfileEditor({ profile, onChange }: ProfileEditorProps) {
  const [markdown, setMarkdown] = useState(() => profileToMarkdown(profile))
  const lastProfileRef = useRef(profile)

  // If profile changes externally (e.g. from canvas edit), re-serialize
  if (profile !== lastProfileRef.current) {
    lastProfileRef.current = profile
    const newMd = profileToMarkdown(profile)
    if (newMd !== markdown) {
      setMarkdown(newMd)
    }
  }

  const handleChange = useCallback((md: string) => {
    setMarkdown(md)
    const parsed = markdownToProfile(md)
    onChange(parsed)
  }, [onChange])

  return (
    <MilkdownEditor
      value={markdown}
      onChange={handleChange}
      placeholder="Edit your profile in markdown..."
      variant="borderless"
      minHeight="100%"
    />
  )
}
