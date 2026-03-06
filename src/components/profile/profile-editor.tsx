import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { ContactSection } from './contact-section'
import { ExperienceSection } from './experience-section'
import { EducationSection } from './education-section'
import { ProjectsSection } from './projects-section'
import { SkillsSection } from './skills-section'
import { User, Briefcase, GraduationCap, FolderKanban, Wrench } from 'lucide-react'
import type { Profile } from '@/types/jobs'

interface ProfileEditorProps {
  profile: Profile
  onChange: (updates: Partial<Profile>) => void
}

export function ProfileEditor({ profile, onChange }: ProfileEditorProps) {
  return (
    <Accordion
      type="multiple"
      defaultValue={['contact', 'experience', 'education', 'projects', 'skills']}
      className="space-y-2"
    >
      <AccordionItem value="contact" className="border-white/[0.08]">
        <AccordionTrigger className="text-zinc-100">
          <div className="flex items-center gap-2">
            <User size={16} className="text-zinc-400" />
            Contact & Summary
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <ContactSection profile={profile} onChange={onChange} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="experience" className="border-white/[0.08]">
        <AccordionTrigger className="text-zinc-100">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-zinc-400" />
            Experience
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <ExperienceSection
            experiences={profile.experiences ?? []}
            onChange={(experiences) => onChange({ experiences })}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="education" className="border-white/[0.08]">
        <AccordionTrigger className="text-zinc-100">
          <div className="flex items-center gap-2">
            <GraduationCap size={16} className="text-zinc-400" />
            Education
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <EducationSection
            educations={profile.educations ?? []}
            onChange={(educations) => onChange({ educations })}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="projects" className="border-white/[0.08]">
        <AccordionTrigger className="text-zinc-100">
          <div className="flex items-center gap-2">
            <FolderKanban size={16} className="text-zinc-400" />
            Projects
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <ProjectsSection
            projects={profile.projects ?? []}
            onChange={(projects) => onChange({ projects })}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="skills" className="border-white/[0.08]">
        <AccordionTrigger className="text-zinc-100">
          <div className="flex items-center gap-2">
            <Wrench size={16} className="text-zinc-400" />
            Skills & Languages
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <SkillsSection
            skills={profile.skills ?? []}
            languages={profile.languages ?? []}
            onSkillsChange={(skills) => onChange({ skills })}
            onLanguagesChange={(languages) => onChange({ languages })}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
