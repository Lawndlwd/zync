import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/services/jobs'
import type { CampaignStatus, JobStatus } from '@zync/shared/types'

// ── Queries ──

export function useCampaigns() {
  return useQuery({
    queryKey: ['jobs', 'campaigns'],
    queryFn: api.fetchCampaigns,
    staleTime: 30_000,
  })
}

export function useJobs(campaignId: number | undefined, status?: JobStatus) {
  return useQuery({
    queryKey: ['jobs', 'list', campaignId, status],
    queryFn: () => api.fetchCampaignJobs(campaignId!, status),
    enabled: !!campaignId,
    staleTime: 15_000,
  })
}

export function useJob(id: number | undefined) {
  return useQuery({
    queryKey: ['jobs', 'detail', id],
    queryFn: () => api.fetchJob(id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useProfile() {
  return useQuery({
    queryKey: ['jobs', 'profile'],
    queryFn: api.fetchProfile,
    staleTime: 60_000,
  })
}

export function useJobDocs(jobId: number | undefined) {
  return useQuery({
    queryKey: ['jobs', 'docs', jobId],
    queryFn: () => api.fetchJobDocs(jobId!),
    enabled: !!jobId,
    staleTime: 30_000,
  })
}

export function useJobStats(campaignId?: number) {
  return useQuery({
    queryKey: ['jobs', 'stats', campaignId],
    queryFn: () => api.fetchJobStats(campaignId),
    staleTime: 30_000,
  })
}

export function useScrapeSchedule() {
  return useQuery({
    queryKey: ['jobs', 'schedule'],
    queryFn: api.fetchSchedule,
    staleTime: 60_000,
  })
}

// ── Mutations ──

export function useCreateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs', 'campaigns'] }),
  })
}

export function useUpdateCampaignStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: CampaignStatus }) =>
      api.updateCampaignStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs', 'campaigns'] })
    },
  })
}

export function useDeleteCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs', 'campaigns'] }),
  })
}

export function useUpdateJobStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: JobStatus }) =>
      api.updateJobStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs', 'profile'] }),
  })
}

export function useUploadResume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.uploadResume,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs', 'profile'] }),
  })
}

export function useGenerateCoverLetter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.generateCoverLetter,
    onSuccess: (_data, jobId) => {
      qc.invalidateQueries({ queryKey: ['jobs', 'docs', jobId] })
    },
  })
}

export function useGenerateInterviewPrep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.generateInterviewPrep,
    onSuccess: (_data, jobId) => {
      qc.invalidateQueries({ queryKey: ['jobs', 'docs', jobId] })
    },
  })
}

export function useTriggerScrape() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.triggerScrape,
    onSuccess: () => {
      // Refresh jobs after a delay to allow scraping to complete
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['jobs'] })
      }, 5000)
    },
  })
}
