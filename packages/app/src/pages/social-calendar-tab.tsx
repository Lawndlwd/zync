import { useSocialFilter } from '@/store/social-filter'
import { ContentCalendar } from '@/components/social/content-calendar'

export function SocialCalendarTab() {
  const { platform } = useSocialFilter()
  return (
    <div className="h-full">
      <ContentCalendar platform={platform ?? 'instagram'} />
    </div>
  )
}
