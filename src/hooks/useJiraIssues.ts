import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import * as jiraService from '@/services/jira'
import { useSettingsStore } from '@/store/settings'
import type { CreateIssuePayload } from '@/types/jira'

export function useJiraIssues() {
  const jql = useSettingsStore((s) => s.settings.jira.defaultJql)
  const boardId = useSettingsStore((s) => s.settings.jira.boardId)

  return useQuery({
    queryKey: ['jira-issues', boardId, jql],
    queryFn: () =>
      boardId
        ? jiraService.fetchBoardIssues(boardId, jql)
        : jiraService.searchIssues(jql),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useJiraBoards(search?: string) {
  const projectKey = useSettingsStore((s) => s.settings.jira.projectKey)

  return useQuery({
    queryKey: ['jira-boards', projectKey, search],
    queryFn: () =>
      jiraService.fetchBoards({
        projectKey: projectKey || undefined,
        search: search || undefined,
        maxResults: 50,
      }),
    retry: 1,
  })
}

export function useBoardConfig(boardId: number | null) {
  return useQuery({
    queryKey: ['jira-board-config', boardId],
    queryFn: () => jiraService.fetchBoardConfig(boardId!),
    enabled: !!boardId,
  })
}

export function useActiveSprint(boardId: number | null) {
  return useQuery({
    queryKey: ['jira-active-sprint', boardId],
    queryFn: () => jiraService.fetchActiveSprint(boardId!),
    enabled: !!boardId,
  })
}

export function useJiraIssue(issueKey: string) {
  return useQuery({
    queryKey: ['jira-issue', issueKey],
    queryFn: () => jiraService.getIssue(issueKey),
    enabled: !!issueKey,
  })
}

export function useJiraTransitions(issueKey: string) {
  return useQuery({
    queryKey: ['jira-transitions', issueKey],
    queryFn: () => jiraService.getTransitions(issueKey),
    enabled: !!issueKey,
  })
}

export function useTransitionIssue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ issueKey, transitionId }: { issueKey: string; transitionId: string }) =>
      jiraService.transitionIssue(issueKey, transitionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-issues'] })
    },
  })
}

export function useAddComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ issueKey, body }: { issueKey: string; body: string }) =>
      jiraService.addComment(issueKey, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-issues'] })
    },
  })
}

// ── Issue Creation Hooks ──

export function useProjectMeta(projectKey: string) {
  return useQuery({
    queryKey: ['jira-project-meta', projectKey],
    queryFn: () => jiraService.fetchProjectMeta(projectKey),
    enabled: !!projectKey,
    staleTime: 5 * 60_000,
  })
}

export function useSearchUsers(query: string, projectKey?: string) {
  return useQuery({
    queryKey: ['jira-users', query, projectKey],
    queryFn: () => jiraService.searchUsers(query, projectKey),
    enabled: query.length >= 2,
    placeholderData: keepPreviousData,
  })
}

export function useCreateFields(projectKey: string, issueTypeId: string) {
  return useQuery({
    queryKey: ['jira-create-fields', projectKey, issueTypeId],
    queryFn: () => jiraService.fetchCreateFields(projectKey, issueTypeId),
    enabled: !!projectKey && !!issueTypeId,
    staleTime: 5 * 60_000,
  })
}

export function useCreateIssue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateIssuePayload) => jiraService.createIssue(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-issues'] })
    },
  })
}

export function useProjects() {
  return useQuery({
    queryKey: ['jira-projects'],
    queryFn: () => jiraService.fetchProjects(),
    staleTime: 10 * 60_000,
  })
}

export function useUploadAttachments() {
  return useMutation({
    mutationFn: ({ issueKey, files }: { issueKey: string; files: File[] }) =>
      jiraService.uploadAttachments(issueKey, files),
  })
}
