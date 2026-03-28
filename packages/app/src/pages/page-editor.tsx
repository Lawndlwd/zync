import { useNavigate, useParams } from 'react-router-dom'
import { PageView } from '@/components/planner/page-view'

export function PageEditorPage() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()

  if (!pageId) {
    navigate('/', { replace: true })
    return null
  }

  return <PageView pageId={pageId} onNavigate={() => navigate(-1)} />
}
