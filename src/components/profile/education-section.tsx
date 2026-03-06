import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'
import type { ProfileEducation } from '@/types/jobs'

interface EducationSectionProps {
  educations: ProfileEducation[]
  onChange: (educations: ProfileEducation[]) => void
}

export function EducationSection({ educations, onChange }: EducationSectionProps) {
  const update = (index: number, fields: Partial<ProfileEducation>) => {
    const updated = educations.map((edu, i) => (i === index ? { ...edu, ...fields } : edu))
    onChange(updated)
  }

  const remove = (index: number) => {
    onChange(educations.filter((_, i) => i !== index))
  }

  const addEducation = () => {
    onChange([
      ...educations,
      {
        id: crypto.randomUUID(),
        school: '',
        degree: '',
        field: '',
        startDate: '',
        endDate: '',
        gpa: '',
      },
    ])
  }

  return (
    <div className="space-y-4">
      {educations.map((edu, i) => (
        <Card key={edu.id} className="relative p-4 bg-white/[0.03] border-white/[0.08]">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 text-zinc-500 hover:text-red-400"
            onClick={() => remove(i)}
          >
            <Trash2 size={14} />
          </Button>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">School</Label>
              <Input
                value={edu.school}
                onChange={(e) => update(i, { school: e.target.value })}
                placeholder="School name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">Degree</Label>
              <Input
                value={edu.degree}
                onChange={(e) => update(i, { degree: e.target.value })}
                placeholder="e.g. B.S."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">Field</Label>
              <Input
                value={edu.field ?? ''}
                onChange={(e) => update(i, { field: e.target.value })}
                placeholder="Field of study"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">Start Date</Label>
              <Input
                value={edu.startDate}
                onChange={(e) => update(i, { startDate: e.target.value })}
                placeholder="e.g. Sep 2018"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">End Date</Label>
              <Input
                value={edu.endDate ?? ''}
                onChange={(e) => update(i, { endDate: e.target.value })}
                placeholder="e.g. Jun 2022"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-xs">GPA</Label>
            <Input
              value={edu.gpa ?? ''}
              onChange={(e) => update(i, { gpa: e.target.value })}
              placeholder="e.g. 3.8/4.0"
              className="max-w-[200px]"
            />
          </div>
        </Card>
      ))}

      <Button
        variant="outline"
        className="w-full border-dashed border-white/[0.1] text-zinc-400 hover:text-zinc-200"
        onClick={addEducation}
      >
        <Plus size={16} className="mr-2" />
        Add Education
      </Button>
    </div>
  )
}
