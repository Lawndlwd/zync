import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as gitlabService from '@/services/gitlab'
import type { CreateMRPayload, PendingComment, GitLabDiffRefs, GitLabDiffPosition } from '@zync/shared/types'

export function useGitlabUser() {
  return useQuery({
    queryKey: ['gitlab-user'],
    queryFn: () => gitlabService.fetchCurrentUser(),
    staleTime: 10 * 60_000,
    retry: 1,
  })
}

export function useGitlabProjects(search?: string) {
  return useQuery({
    queryKey: ['gitlab-projects', search],
    queryFn: () => gitlabService.fetchProjects(search),
    staleTime: 5 * 60_000,
    retry: 1,
  })
}

export function useGitlabProjectMembers(projectId: number | null) {
  return useQuery({
    queryKey: ['gitlab-members', projectId],
    queryFn: () => gitlabService.fetchProjectMembers(projectId!),
    enabled: !!projectId,
    staleTime: 5 * 60_000,
  })
}

export function useGitlabMRs(
  projectId: number | null,
  filter?: { scope?: string; reviewer_username?: string; author_username?: string }
) {
  return useQuery({
    queryKey: ['gitlab-mrs', projectId, filter],
    queryFn: () => gitlabService.fetchMergeRequests(projectId!, filter),
    enabled: !!projectId,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useGitlabMR(projectId: number | null, iid: number | null) {
  return useQuery({
    queryKey: ['gitlab-mr', projectId, iid],
    queryFn: () => gitlabService.fetchMergeRequest(projectId!, iid!),
    enabled: !!projectId && !!iid,
  })
}

export function useGitlabMRChanges(projectId: number | null, iid: number | null) {
  return useQuery({
    queryKey: ['gitlab-mr-changes', projectId, iid],
    queryFn: () => gitlabService.fetchMRChanges(projectId!, iid!),
    enabled: !!projectId && !!iid,
    staleTime: 2 * 60_000,
  })
}

export function useGitlabMRNotes(projectId: number | null, iid: number | null) {
  return useQuery({
    queryKey: ['gitlab-mr-notes', projectId, iid],
    queryFn: () => gitlabService.fetchMRNotes(projectId!, iid!),
    enabled: !!projectId && !!iid,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  })
}

export function useGitlabMRApprovals(projectId: number | null, iid: number | null) {
  return useQuery({
    queryKey: ['gitlab-mr-approvals', projectId, iid],
    queryFn: () => gitlabService.fetchMRApprovals(projectId!, iid!),
    enabled: !!projectId && !!iid,
  })
}

export function useAddMRNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, iid, body }: { projectId: number; iid: number; body: string }) =>
      gitlabService.addMRNote(projectId, iid, body),
    onSuccess: async (_data, { projectId, iid }) => {
      await queryClient.refetchQueries({ queryKey: ['gitlab-mr-notes', projectId, iid] })
    },
  })
}

export function useEditMRNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, iid, noteId, body }: { projectId: number; iid: number; noteId: number; body: string }) =>
      gitlabService.editMRNote(projectId, iid, noteId, body),
    onSuccess: async (_data, { projectId, iid }) => {
      await queryClient.refetchQueries({ queryKey: ['gitlab-mr-notes', projectId, iid] })
    },
  })
}

export function useDeleteMRNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, iid, noteId }: { projectId: number; iid: number; noteId: number }) =>
      gitlabService.deleteMRNote(projectId, iid, noteId),
    onSuccess: async (_data, { projectId, iid }) => {
      await queryClient.refetchQueries({ queryKey: ['gitlab-mr-notes', projectId, iid] })
    },
  })
}

export function useCreateMR() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: number; payload: CreateMRPayload }) =>
      gitlabService.createMR(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gitlab-mrs'] })
    },
  })
}

export function useGitlabContributors(projectId: number | null) {
  return useQuery({
    queryKey: ['gitlab-contributors', projectId],
    queryFn: () => gitlabService.fetchContributors(projectId!),
    enabled: !!projectId,
    staleTime: 10 * 60_000,
    retry: 1,
  })
}

export function useGitlabMRStats(projectId: number | null, username: string | undefined, days = 90) {
  return useQuery({
    queryKey: ['gitlab-mr-stats', projectId, username, days],
    queryFn: () => gitlabService.fetchMRStats(projectId!, username!, days),
    enabled: !!projectId && !!username,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}

export function useSubmitReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      projectId,
      iid,
      comments,
      diffRefs,
    }: {
      projectId: number
      iid: number
      comments: PendingComment[]
      diffRefs: GitLabDiffRefs
    }) => {
      for (const comment of comments) {
        const position: GitLabDiffPosition = {
          base_sha: diffRefs.base_sha,
          start_sha: diffRefs.start_sha,
          head_sha: diffRefs.head_sha,
          position_type: 'text',
          old_path: comment.oldPath,
          new_path: comment.filePath,
          old_line: comment.oldLine,
          new_line: comment.newLine,
        }
        await gitlabService.createMRDiscussion(projectId, iid, comment.body, position)
      }
    },
    onSuccess: async (_data, { projectId, iid }) => {
      await queryClient.refetchQueries({ queryKey: ['gitlab-mr-notes', projectId, iid] })
    },
  })
}

export function useGitlabBranches(projectId: number | null, search?: string) {
  return useQuery({
    queryKey: ['gitlab-branches', projectId, search],
    queryFn: () => gitlabService.fetchBranches(projectId!, search),
    enabled: !!projectId,
    staleTime: 2 * 60_000,
  })
}
