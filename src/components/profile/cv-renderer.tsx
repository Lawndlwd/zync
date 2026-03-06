import type { Profile, CvTheme } from '@/types/jobs'
import { TEMPLATE_COMPONENTS } from './templates'

interface CvRendererProps {
  profile: Profile
  theme: CvTheme
}

export function CvRenderer({ profile, theme }: CvRendererProps) {
  const Template = TEMPLATE_COMPONENTS[theme.template]

  if (!Template) {
    return <div style={{ padding: 20, color: 'red' }}>Unknown template: {theme.template}</div>
  }

  return <Template profile={profile} theme={theme} />
}
