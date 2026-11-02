import { describe, expect, it } from 'vitest'

import type { Identity, TodayRow } from '../types/becoming'
import {
  becomingItems,
  dayBar,
  hoursLabel,
  isoWeekOf,
  shiftWeek,
  weekLabel,
  guardAt,
  guardBands,
  markGuarded,
  guardText,
  parseGuard,
  parseSignal,
  progressText,
  rowChip,
  signalText,
  targetSub,
  targetText,
} from './becoming'

const identity = (over: Partial<Identity> = {}): Identity => ({
  file: 'runner.md',
  statement: 'I am a runner',
  action: 'Run 5k',
  small: 'Put on shoes, walk out',
  minutes: 30,
  signals: [{ manual: true }],
  guards: [],
  stage: 'experiment',
  since: '2026-09-20',
  stageSince: '2026-09-20',
  why: '',
  proof: [],
  ...over,
})
const row = (over: Partial<TodayRow> = {}): TodayRow => ({
  identity: identity(),
  target: 'small',
  missedYesterday: false,
  manual: true,
  progress: { stage: 'experiment', day: 9, weeks: 0, weeksNeeded: 0, perWeek: 3 },
  strip: [],
  ...over,
})

describe('today rows', () => {
  it('asks for the small version on a heavy day', () => {
    expect(targetText(row())).toBe('Put on shoes, walk out')
    expect(targetSub(row())).toBe('small · full is run 5k')
    expect(targetSub(row({ vote: { kind: 'full', source: 'tap' } }))).toBe('small asked · you did the full thing')
    expect(targetSub(row({ target: 'full' }))).toBe('full · small is put on shoes, walk out')
  })

  it('offers Full / Small only when Zync can’t see it', () => {
    expect(rowChip(row())).toEqual({ tone: 'vote' })
    expect(rowChip(row({ vote: { kind: 'small', source: 'tap' } }))).toEqual({ tone: 'evid', text: 'small · tapped' })
    const writer = identity({ signals: [{ files: 'Writing/' }] })
    expect(rowChip(row({ identity: writer, manual: false }))).toEqual({
      tone: 'wait',
      text: 'auto · when you edit Writing/',
    })
    expect(
      rowChip(
        row({ identity: writer, manual: false, vote: { kind: 'full', source: 'auto', note: '40 min in Essay.md' } }),
      ),
    ).toEqual({ tone: 'evid', text: 'auto · 40 min in Essay.md' })
  })

  it('shows a guard identity as its guard', () => {
    const present = identity({ signals: [], guards: [{ label: 'Present at home', from: '19:00', to: '24:00' }] })
    expect(rowChip(row({ identity: present, manual: false }))).toEqual({ tone: 'guard', text: 'guard · on at 19:00' })
    expect(targetSub(row({ identity: present }))).toBe('counts when present at home holds')
  })

  it('says how far the next stage is', () => {
    const p = { stage: 'trying' as const, weeks: 1, weeksNeeded: 4, perWeek: 3 }
    expect(progressText(p, identity())).toBe('3 more weeks with 3+ votes → Sticking')
    expect(progressText({ ...p, stage: 'sticking', weeksNeeded: 3, weeks: 2 }, identity())).toBe(
      '1 more steady week → Part of me',
    )
    expect(progressText({ stage: 'experiment', day: 9, weeks: 0, weeksNeeded: 0, perWeek: 3 }, identity())).toBe(
      'Day 9 of 28 → then keep or let go',
    )
  })
})

describe('signals in plain words', () => {
  it.each([
    [{ files: 'Writing/' }, 'editing anything in Writing/'],
    [{ event: 'run' }, 'calendar event with “run”'],
    [{ card: { label: 'essay' } }, 'card labeled essay → done'],
    [{ manual: true as const }, 'voted by hand'],
    [{ workout: {} }, 'Workouts logged in Training'],
    [{ workout: { minMinutes: 30 } }, 'Workouts logged in Training · 30+ min'],
  ])('%j reads back from “%s”', (signal, text) => {
    expect(signalText(signal)).toBe(text)
    expect(parseSignal(text)).toEqual(signal)
  })

  it('takes shorthands', () => {
    expect(parseSignal('files: Notes')).toEqual({ files: 'Notes' })
    expect(parseSignal('card: #ship on ideas')).toEqual({ card: { label: 'ship', board: 'ideas' } })
    expect(parseSignal('workout')).toEqual({ workout: {} })
    expect(parseSignal('workout: 45')).toEqual({ workout: { minMinutes: 45 } })
    expect(parseSignal('whatever')).toBeNull()
  })
})

describe('guards', () => {
  it('reads back what it writes', () => {
    const g = {
      label: 'Mornings are for writing',
      from: '07:00',
      to: '09:00',
      days: ['mon', 'tue', 'wed', 'thu', 'fri'] as const,
    }
    const text = guardText({ ...g, days: [...g.days] })
    expect(text).toBe('Mornings are for writing · 07:00–09:00 · weekdays')
    expect(parseGuard(text)).toEqual({ ...g, days: [...g.days] })
    expect(parseGuard('19:00-24:00 Present at home')).toEqual({ label: 'Present at home', from: '19:00', to: '24:00' })
    expect(parseGuard('Late · 22:00–20:00')).toBeNull()
  })

  it('finds the guard a time falls inside, with a time before it', () => {
    const present = identity({ guards: [{ label: 'Present at home', from: '19:00', to: '24:00' }] })
    expect(guardAt('2026-09-28T20:30', [present])).toMatchObject({
      guard: { label: 'Present at home' },
      suggest: '17:30',
    })
    expect(guardAt('2026-09-28T18:30', [present])).toBeNull()
    expect(guardAt('2026-09-28', [present])).toBeNull()
  })
})

const at = (start: string) => ({
  id: start,
  kind: 'event' as const,
  title: 'x',
  start,
  end: start,
  allDay: false,
  ref: '',
  editable: true,
})

describe('calendar', () => {
  const present = identity({
    file: 'present.md',
    signals: [],
    guards: [{ label: 'Present at home', from: '19:00', to: '24:00', days: ['mon'] }],
  })

  it('shades guards on the days they apply', () => {
    expect(guardBands([present], ['2026-09-28', '2026-09-29'])).toEqual([
      { day: '2026-09-28', from: 1140, to: 1440, label: 'Present at home' },
    ])
  })

  it('shows placed identities with their target, never guard windows', () => {
    const items = becomingItems(
      [
        { identity: 'runner.md', start: '2026-09-28T18:30', end: '2026-09-28T18:40', movedFrom: '18:00' },
        { identity: 'present.md', start: '2026-09-28T19:00', end: '2026-09-28T23:59', guard: true },
      ],
      [identity(), present],
    )
    expect(items).toMatchObject([
      { kind: 'becoming', title: 'Runner · put on shoes, walk out', movedFrom: '18:00', editable: false },
    ])
    expect(items).toHaveLength(1)
  })

  it('marks what falls inside a guard', () => {
    const [late, early] = markGuarded([at('2026-09-28T20:00'), at('2026-09-28T18:00')], [present])
    expect(late?.warn).toBe('Present at home')
    expect(early?.warn).toBeUndefined()
  })
})

describe('the Mirror’s weeks', () => {
  it('names ISO weeks and steps through them', () => {
    expect(isoWeekOf('2026-09-27')).toBe('2026-W39')
    expect(isoWeekOf('2026-09-28')).toBe('2026-W40')
    expect(isoWeekOf('2021-01-03')).toBe('2020-W53')
    expect(shiftWeek('2026-W39', -1)).toBe('2026-W38')
    expect(shiftWeek('2026-W53', 1)).toBe('2027-W01')
    expect(weekLabel('2026-W39')).toBe('week 39 · 21–27 Sep')
    expect(weekLabel('2026-W40')).toBe('week 40 · 28 Sep–04 Oct')
  })

  it('writes durations and day bars', () => {
    expect(hoursLabel(130)).toBe('2h10')
    expect(hoursLabel(35)).toBe('0h35')
    expect(hoursLabel(1860)).toBe('31h')
    expect(dayBar('06:00', '15:00')).toEqual({ left: 0, width: 50 })
  })
})
