import type { ComponentType } from 'react'
import type { Profile, CvTheme, CvTemplateId } from '@zync/shared/types'

export interface TemplateProps {
  profile: Profile
  theme: CvTheme
}

// Lazy-load templates to keep bundle small
import { ClassicTemplate } from './classic'
import { ModernLeftTemplate } from './modern-left'
import { BoldSidebarTemplate } from './bold-sidebar'
import { ExecutiveBannerTemplate } from './executive-banner'
import { MinimalTwoColTemplate } from './minimal-two-col'
import { TimelineTemplate } from './timeline'
import { CompactAtsTemplate } from './compact-ats'
import { MagazineTemplate } from './magazine'

export const TEMPLATE_COMPONENTS: Record<CvTemplateId, ComponentType<TemplateProps>> = {
  'classic': ClassicTemplate,
  'modern-left': ModernLeftTemplate,
  'bold-sidebar': BoldSidebarTemplate,
  'executive-banner': ExecutiveBannerTemplate,
  'minimal-two-col': MinimalTwoColTemplate,
  'timeline': TimelineTemplate,
  'compact-ats': CompactAtsTemplate,
  'magazine': MagazineTemplate,
}
