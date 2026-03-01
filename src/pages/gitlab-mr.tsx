import { useParams, useNavigate } from 'react-router-dom'
import { useGitlabMR } from '@/hooks/useGitlab'
import { MRDetail } from '@/components/gitlab/mr-detail'
import { Skeleton } from '@/components/ui/skeleton'

export function GitLabMRPage() {
  const { projectId, iid } = useParams<{ projectId: string; iid: string }>()
  const navigate = useNavigate()
  const pid = Number(projectId)
  const mrIid = Number(iid)

  const { data: mr, isLoading, isError } = useGitlabMR(pid || null, mrIid || null)

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] p-6">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    )
  }

  if (isError || !mr) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-red-400 mb-4">Failed to load merge request</p>
        <button
          onClick={() => navigate('/gitlab')}
          className="text-sm text-indigo-400 hover:underline"
        >
          Back to GitLab
        </button>
      </div>
    )
  }

  return (
    <div className="-mx-8 -mt-8 -mb-8 xl:-mx-10 h-screen">
      <MRDetail
        key={`${pid}-${mrIid}`}
        mr={mr}
        projectId={pid}
        onClose={() => navigate('/gitlab')}
      />
    </div>
  )
}
