import { describe, expect, it } from 'vitest'

import {
  boardUrl,
  chatUrlFor,
  fileUrl,
  folderUrl,
  libraryUrl,
  routineUrl,
  sessionUrl,
  trainingUrl,
  workoutUrl,
  wsUrl,
} from './urls'

describe('app urls', () => {
  it('builds workspace urls with encoded segments', () => {
    expect(wsUrl('my ws')).toBe('/w/my%20ws')
    expect(wsUrl('w', 'jobs')).toBe('/w/w/jobs')
    expect(fileUrl('w', 'a b/c.md')).toBe('/w/w/files/a%20b/c.md')
    expect(boardUrl('w', 'projects/Sprint 1')).toBe('/w/w/boards/projects/Sprint%201')
    expect(folderUrl('w', '')).toBe('/w/w/files')
    expect(folderUrl('w', 'a/b')).toBe('/w/w/files?dir=a%2Fb')
    expect(libraryUrl('w')).toBe('/w/w/opencode')
    expect(libraryUrl('w', 'skills/x/SKILL.md')).toBe('/w/w/opencode/skills/x/SKILL.md')
    expect(sessionUrl('w', 'ses 1')).toBe('/w/w/chat?session=ses%201')
    expect(trainingUrl('w')).toBe('/w/w/training')
    expect(trainingUrl('w', 'log')).toBe('/w/w/training/log')
    expect(workoutUrl('w', '2026-09-29-push day.md')).toBe('/w/w/training/workout/2026-09-29-push%20day.md')
    expect(routineUrl('w', 'push.md')).toBe('/w/w/training/routines?open=push.md')
  })

  it('addresses a v2 chat session as the base64url of the origin', () => {
    expect(chatUrlFor('http://127.0.0.1:4096', 'ses_1')).toBe('/server/aHR0cDovLzEyNy4wLjAuMTo0MDk2/session/ses_1')
    // UTF-8, unpadded base64url
    expect(chatUrlFor('https://zync.é.test', 'ses_1')).toBe(
      `/server/${Buffer.from('https://zync.é.test').toString('base64url')}/session/ses_1`,
    )
  })
})
