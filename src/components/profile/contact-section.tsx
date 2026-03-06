import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Profile } from '@/types/jobs'

interface ContactSectionProps {
  profile: Profile
  onChange: (fields: Partial<Profile>) => void
}

export function ContactSection({ profile, onChange }: ContactSectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-zinc-400 text-xs">Name</Label>
          <Input
            value={profile.name ?? ''}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Full name"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-zinc-400 text-xs">Title</Label>
          <Input
            value={profile.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Job title"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-zinc-400 text-xs">Email</Label>
          <Input
            value={profile.email ?? ''}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="Email address"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-zinc-400 text-xs">Phone</Label>
          <Input
            value={profile.phone ?? ''}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="Phone number"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-zinc-400 text-xs">Location</Label>
          <Input
            value={profile.location ?? ''}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="City, Country"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-zinc-400 text-xs">LinkedIn</Label>
          <Input
            value={profile.linkedin ?? ''}
            onChange={(e) => onChange({ linkedin: e.target.value })}
            placeholder="LinkedIn URL"
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="text-zinc-400 text-xs">Website</Label>
          <Input
            value={profile.website ?? ''}
            onChange={(e) => onChange({ website: e.target.value })}
            placeholder="Personal website URL"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-zinc-400 text-xs">Summary</Label>
        <Textarea
          value={profile.summary ?? ''}
          onChange={(e) => onChange({ summary: e.target.value })}
          placeholder="Professional summary..."
          rows={4}
        />
      </div>
    </div>
  )
}
