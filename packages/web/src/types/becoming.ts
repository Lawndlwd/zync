// Becoming: identity pages in Becoming/, their votes, and the day seen through them (mirrors
// @zync/jobs becoming/types.ts and today.ts).

export type Stage = 'experiment' | 'trying' | 'sticking' | 'part'
export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

export type Signal =
  | { files: string }
  | { event: string }
  | { card: { label?: string; board?: string } }
  /** A finished workout in Training/Log: full from `minMinutes` (default 20), small below. */
  | { workout: { minMinutes?: number } }
  | { manual: true }

export type Guard = { label: string; from: string; to: string; days?: Weekday[] }

export type ProofLine = { date: string; text: string; source: string }

export type Identity = {
  file: string
  statement: string
  action: string
  small?: string
  /** A window or "HH:MM". */
  when?: string
  minutes: number
  signals: Signal[]
  guards: Guard[]
  stage: Stage
  since: string
  stageSince: string
  quietUntil?: string
  why: string
  proof: ProofLine[]
}

export type IdentityInput = {
  statement: string
  action: string
  small?: string
  when?: string
  minutes?: number
  signals?: Signal[]
  guards?: Guard[]
  stage?: Stage
  why?: string
}

/** `null` clears an optional field. */
export type IdentityPatch = {
  statement?: string
  action?: string
  small?: string | null
  when?: string | null
  minutes?: number
  signals?: Signal[]
  guards?: Guard[]
  stage?: Stage
  quietUntil?: string | null
  why?: string
}

export type VoteKind = 'full' | 'small' | 'clear'
export type VoteSource = 'auto' | 'tap' | 'palette' | 'ntfy' | 'ai'
export type DayVote = { kind: 'full' | 'small'; source: VoteSource; note?: string }
type Evidence = { kind: 'full' | 'small'; note: string }

export type Slot = { identity: string; start: string; end: string; movedFrom?: string; guard?: true }

export type StripCell = 'full' | 'small' | 'none' | 'before'

export type StageProgress = {
  stage: Stage
  day?: number
  weeks: number
  weeksNeeded: number
  perWeek: number
  suggest?: Stage
}

export type TodayRow = {
  identity: Identity
  target: 'full' | 'small'
  slot?: Slot
  vote?: DayVote
  evidence?: Evidence
  missedYesterday: boolean
  manual: boolean
  progress: StageProgress
  strip: StripCell[]
}

type DayMode = { mode: 'heavy' | 'open'; meetings: number; longestGap: number; reason: string }

type OneCard = { title: string; board: string; file: string; identity: string }

export type BecomingToday = { date: string; day: DayMode; rows: TodayRow[]; oneCard?: OneCard }

export type BecomingSlots = { identities: Identity[]; slots: Slot[] }

type WindowSpan = { date: string; start: string; end: string }

export type IdentityWeek = {
  file: string
  statement: string
  minutes: number
  votes: number
  full: number
  small: number
  cards: number
  spans: WindowSpan[]
  kept?: string[]
}

export type BecomingWeek = {
  week: string
  from: string
  to: string
  daysTracked: number
  identities: IdentityWeek[]
  unclaimed: {
    minutes: number
    recurringMinutes: number
    events: Array<{ title: string; minutes: number; recurring: boolean }>
  }
  trackedMinutes: number
}

export type MirrorFact = { identity?: string; text: string }
export type MirrorQuestion = { identity?: string; q: string; options: string[]; answer?: string }
export type MirrorChange = {
  label: string
  detail?: string
  identity: string
  patch: { guards?: Guard[]; when?: string; small?: string; minutes?: number }
  alternative?: string
  applied?: boolean
}

export type Mirror = {
  week: string
  generated: string
  stats: BecomingWeek
  facts: MirrorFact[]
  questions: MirrorQuestion[]
  change?: MirrorChange
  body: string
}
