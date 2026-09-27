import { useQueries, useQuery } from '@tanstack/react-query'

import { api } from '../api'
import { stripMd } from '../helpers/paths'
import type { BoardCard, RunEvent, WorkspaceData } from '../types/workspace'

// Everything the shell and the Overview derive their numbers from. Query keys match the other
// views so caches (and live invalidation from the workspace event stream) are shared.

export function useWorkspaceData(ws: string): WorkspaceData {
  const jobs = useQuery({ queryKey: ['jobs', ws], queryFn: () => api.jobs(ws), refetchInterval: 15_000 }).data ?? []
  const boards = useQuery({ queryKey: ['boards', ws], queryFn: () => api.boards(ws) }).data ?? []
  const people = useQuery({ queryKey: ['people'], queryFn: api.people }).data ?? []
  const recentQ = useQuery({ queryKey: ['recent', ws], queryFn: () => api.recent(ws, 100) }).data
  const boardQs = useQueries({
    queries: boards.map((b) => ({
      queryKey: ['board', ws, b.path],
      queryFn: () => api.board(ws, b.path),
    })),
  })
  const runQs = useQueries({
    queries: jobs.map((j) => ({ queryKey: ['runs', ws, j.name], queryFn: () => api.runs(ws, j.name) })),
  })

  const cards: BoardCard[] = []
  for (const q of boardQs) {
    if (!q.data) continue
    for (const card of q.data.cards) cards.push({ board: q.data.board, card, ref: `${q.data.board.path}/${card.file}` })
  }

  const byRef = new Map(cards.map((c) => [c.ref, c]))
  const runs: RunEvent[] = []
  jobs.forEach((j, i) => {
    const ref = j.job?.card
    const title = ref ? (byRef.get(ref)?.card.title ?? stripMd(ref)) : j.name
    for (const run of runQs[i]?.data ?? []) {
      runs.push({ job: j.name, title, kind: ref ? 'card' : 'job', run, time: new Date(run.ts) })
    }
  })

  return {
    jobs,
    boards,
    cards,
    runs: runs.toSorted((a, b) => b.time.getTime() - a.time.getTime()),
    recent: recentQ?.entries ?? [],
    fileCount: recentQ?.total ?? 0,
    people,
  }
}
