import { useState } from 'react'
import { useCampaigns, useJobs, useUpdateJobStatus } from '@/hooks/useJobs'
import { CampaignControls } from '@/components/jobs/campaign-controls'
import { JobKanban } from '@/components/jobs/job-kanban'
import { JobDetailDrawer } from '@/components/jobs/job-detail-drawer'
import { ResumeUpload } from '@/components/jobs/resume-upload'
import { JobStatsBar } from '@/components/jobs/job-stats'
import type { Job, JobStatus } from '@/types/jobs'
import { Briefcase } from 'lucide-react'

export function JobsPage() {
  const { data: campaigns = [] } = useCampaigns()
  const [activeCampaignId, setActiveCampaignId] = useState<number | undefined>(
    () => campaigns[0]?.id
  )
  const { data: jobs = [] } = useJobs(activeCampaignId)
  const statusMutation = useUpdateJobStatus()
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

  // Update active campaign when campaigns load for first time
  if (!activeCampaignId && campaigns.length > 0) {
    setActiveCampaignId(campaigns[0].id)
  }

  const handleStatusChange = (id: number, status: JobStatus) => {
    statusMutation.mutate({ id, status })
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-6 pb-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <Briefcase size={22} className="text-amber-400" />
          <h1 className="text-xl font-semibold text-zinc-100">Job Search</h1>
        </div>
        <JobStatsBar campaignId={activeCampaignId} />
      </div>

      {/* Controls row */}
      <div className="grid grid-cols-[1fr_280px] gap-4">
        <CampaignControls
          campaigns={campaigns}
          activeCampaignId={activeCampaignId}
          onSelectCampaign={setActiveCampaignId}
        />
        <ResumeUpload />
      </div>

      {/* Kanban */}
      {activeCampaignId ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <JobKanban
            jobs={jobs}
            onSelectJob={setSelectedJob}
            onStatusChange={handleStatusChange}
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Briefcase size={40} className="mx-auto mb-3 text-zinc-700" />
            <p className="text-sm text-zinc-500">Create a campaign to start searching for jobs</p>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selectedJob && (
        <JobDetailDrawer
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  )
}
