import { useQueries, useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { api } from '../api'
import { usePeople } from '../hooks/usePeople'
import { BoardTile } from './BoardTile'
import { NewBoard } from './NewBoard'

export function BoardsList() {
  const { ws = '' } = useParams()
  const { data: boards, error } = useQuery({ queryKey: ['boards', ws], queryFn: () => api.boards(ws) })
  const recent = useQuery({ queryKey: ['recent', ws], queryFn: () => api.recent(ws, 100) }).data?.entries ?? []
  const people = usePeople()
  const boardQs = useQueries({
    queries: (boards ?? []).map((b) => ({ queryKey: ['board', ws, b.path], queryFn: () => api.board(ws, b.path) })),
  })

  return (
    <div className="page col g24">
      <div className="col g16">
        <span className="mono muted">{ws} / boards</span>
        <h1 className="display">Boards</h1>
        <p className="lede">
          Each board is a folder. Each card is a <b>.md</b> file inside it — edit them here or in Files.
        </p>
      </div>
      {error && <p className="help err">{error.message}</p>}
      <div className="boards-grid">
        {!boards &&
          [0, 1].map((i) => (
            <div key={i} className="card" style={{ minHeight: 260 }}>
              <div className="skel" style={{ height: 18, width: 140 }} />
            </div>
          ))}
        {boards?.map((b, i) => {
          const cards = boardQs[i]?.data?.cards ?? []
          const lastEdit = recent.find((f) => f.path.startsWith(`${b.path}/`))
          return <BoardTile key={b.path} ws={ws} board={b} cards={cards} people={people} lastEdit={lastEdit?.mtime} />
        })}
        <NewBoard ws={ws} />
      </div>
    </div>
  )
}
