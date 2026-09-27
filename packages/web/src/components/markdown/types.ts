import type { ReactNode } from 'react'

import type { Person } from '../../types/people'

export type Trigger = {
  kind: '@' | '[['
  query: string
  /** Document range the picked item replaces (the trigger and the query typed after it). */
  from: number
  to: number
}

export type PickItem = {
  key: string
  group: 'People' | 'Pages' | 'Recent pages'
  icon: ReactNode
  text: ReactNode
  meta: string
  insert: { person: Person } | { path: string; name: string }
}

export type Live = {
  people: Person[]
  dir: string
  ws?: string | undefined
  openLink: (path: string, beside: boolean) => void
}
