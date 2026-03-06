import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, Trash2, X } from 'lucide-react'
import type { ProfileExperience } from '@/types/jobs'

interface ExperienceSectionProps {
  experiences: ProfileExperience[]
  onChange: (experiences: ProfileExperience[]) => void
}

export function ExperienceSection({ experiences, onChange }: ExperienceSectionProps) {
  const update = (index: number, fields: Partial<ProfileExperience>) => {
    const updated = experiences.map((exp, i) => (i === index ? { ...exp, ...fields } : exp))
    onChange(updated)
  }

  const remove = (index: number) => {
    onChange(experiences.filter((_, i) => i !== index))
  }

  const addExperience = () => {
    onChange([
      ...experiences,
      {
        id: crypto.randomUUID(),
        title: '',
        company: '',
        location: '',
        startDate: '',
        endDate: '',
        bullets: [],
      },
    ])
  }

  const updateBullet = (expIndex: number, bulletIndex: number, value: string) => {
    const bullets = [...experiences[expIndex].bullets]
    bullets[bulletIndex] = value
    update(expIndex, { bullets })
  }

  const removeBullet = (expIndex: number, bulletIndex: number) => {
    const bullets = experiences[expIndex].bullets.filter((_, i) => i !== bulletIndex)
    update(expIndex, { bullets })
  }

  const addBullet = (expIndex: number) => {
    const bullets = [...experiences[expIndex].bullets, '']
    update(expIndex, { bullets })
  }

  return (
    <div className="space-y-4">
      {experiences.map((exp, i) => (
        <Card key={exp.id} className="relative p-4 bg-white/[0.03] border-white/[0.08]">
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
              <Label className="text-zinc-400 text-xs">Title</Label>
              <Input
                value={exp.title}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder="Job title"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">Company</Label>
              <Input
                value={exp.company}
                onChange={(e) => update(i, { company: e.target.value })}
                placeholder="Company"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">Location</Label>
              <Input
                value={exp.location ?? ''}
                onChange={(e) => update(i, { location: e.target.value })}
                placeholder="Location"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">Start Date</Label>
              <Input
                value={exp.startDate}
                onChange={(e) => update(i, { startDate: e.target.value })}
                placeholder="e.g. Jan 2022"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">End Date</Label>
              <Input
                value={exp.endDate ?? ''}
                onChange={(e) => update(i, { endDate: e.target.value })}
                placeholder="e.g. Present"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-400 text-xs">Bullet Points</Label>
            {exp.bullets.map((bullet, bi) => (
              <div key={bi} className="flex items-center gap-2">
                <Input
                  value={bullet}
                  onChange={(e) => updateBullet(i, bi, e.target.value)}
                  placeholder="Describe an achievement..."
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-zinc-500 hover:text-red-400"
                  onClick={() => removeBullet(i, bi)}
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-zinc-200"
              onClick={() => addBullet(i)}
            >
              <Plus size={14} className="mr-1" />
              Add bullet
            </Button>
          </div>
        </Card>
      ))}

      <Button
        variant="outline"
        className="w-full border-dashed border-white/[0.1] text-zinc-400 hover:text-zinc-200"
        onClick={addExperience}
      >
        <Plus size={16} className="mr-2" />
        Add Experience
      </Button>
    </div>
  )
}
