import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { queryWords, scoreFile } from './search.js'

describe('scoreFile', () => {
  it('ignores case and accents, and matches word prefixes', () => {
    expect(scoreFile('resume ECHEANCE', 'a.md', '# Résumé\nL’échéance est vendredi')).not.toBeNull()
    expect(scoreFile('schedul', 'a.md', 'We are scheduling the run')).not.toBeNull()
    expect(queryWords('L’été, 2026 !')).toEqual(['ete', '2026'])
  })

  it('ranks the exact sentence above scattered words', () => {
    const phrase = scoreFile('write the weekly report', 'a.md', 'Please write the weekly report by Friday.')
    const sameLine = scoreFile('write the weekly report', 'b.md', 'report: weekly — the draft we write')
    const scattered = scoreFile('write the weekly report', 'c.md', 'write\n\nthe\n\nweekly\n\nreport')
    expect(phrase && sameLine && scattered).toBeTruthy()
    expect(phrase!.score).toBeGreaterThan(sameLine!.score)
    expect(sameLine!.score).toBeGreaterThan(scattered!.score)
  })

  it('finds a phrase that wraps across lines', () => {
    const hit = scoreFile('open questions for alice', 'a.md', 'end with open\nquestions for Alice')
    expect(hit!.score).toBeGreaterThanOrEqual(100)
  })

  it('needs most of the words, or the file name', () => {
    expect(scoreFile('kanban board roadmap', 'a.md', 'nothing relevant here')).toBeNull()
    expect(scoreFile('kanban board roadmap', 'a.md', 'kanban and board')).not.toBeNull() // 2 of 3
    expect(scoreFile('sprint planning', 'Sprint 1/Planning.md', '')).not.toBeNull()
  })

  it('returns the matching lines as snippets, phrase line first', () => {
    const hit = scoreFile('weekly report', 'a.md', 'intro\nthe report is weekly\nwe write the weekly report here')
    expect(hit!.snippets.map((s) => s.line)).toEqual([3, 2])
    expect(hit!.snippets[0].text).toContain('weekly report')
  })
})

describe('search endpoint', () => {
  it('searches file contents, skipping dotfiles and binaries', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'search-'))
    await mkdir(path.join(root, 'ws/notes'), { recursive: true })
    await writeFile(path.join(root, 'ws/notes/a.md'), '# Plan\nLe résumé de la réunion')
    await writeFile(path.join(root, 'ws/notes/b.md'), 'nothing')
    await writeFile(path.join(root, 'ws/.secret.md'), 'résumé de la réunion')
    await writeFile(path.join(root, 'ws/img.bin'), Buffer.from([0, 1, 2, 0x72, 0x65]))
    const app = createApp({ workspacesRoot: root })
    const res = await request(app).get('/zync/api/ws/ws/search').query({ q: 'resume de la reunion' }).expect(200)
    expect(res.body.results.map((r: any) => r.path)).toEqual(['notes/a.md'])
    expect(res.body.results[0].snippets[0]).toMatchObject({ line: 2, text: 'Le résumé de la réunion' })
    expect((await request(app).get('/zync/api/ws/ws/search').query({ q: 'a' })).body.results).toEqual([])
  })
})
