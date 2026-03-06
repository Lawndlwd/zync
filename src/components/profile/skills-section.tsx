import { Label } from '@/components/ui/label'
import { TagInput } from '@/components/ui/tag-input'

interface SkillsSectionProps {
  skills: string[]
  languages: string[]
  onSkillsChange: (skills: string[]) => void
  onLanguagesChange: (languages: string[]) => void
}

export function SkillsSection({ skills, languages, onSkillsChange, onLanguagesChange }: SkillsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-zinc-400 text-xs">Skills</Label>
        <TagInput
          value={skills}
          onChange={onSkillsChange}
          placeholder="Add skill..."
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-zinc-400 text-xs">Languages</Label>
        <TagInput
          value={languages}
          onChange={onLanguagesChange}
          placeholder="Add language..."
        />
      </div>
    </div>
  )
}
