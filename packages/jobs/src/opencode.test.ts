import { afterEach, describe, expect, it, vi } from 'vitest'

import { OpencodeClient, opencodeAuthHeader, parseSseEvent, resultOf } from './opencode.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

const text = (t: string) => ({ type: 'text', text: t })

describe('resultOf', () => {
  it('is not done until opencode logs the run idle', () => {
    expect(resultOf([{ type: 'assistant', finish: 'tool-calls', content: [text('working')] }])).toEqual({
      done: false,
      failed: false,
      text: 'working',
    })
  })

  it('reads the last answer of a run that succeeded', () => {
    const msgs = [
      { type: 'idle', outcome: 'succeeded' },
      { type: 'assistant', content: [{ type: 'reasoning', text: 'hmm' }, text('pong')] },
      { type: 'assistant', content: [text('earlier')] },
      { type: 'user', text: 'ping' },
    ]
    expect(resultOf(msgs)).toEqual({ done: true, failed: false, text: 'pong' })
  })

  it('reports why a run failed', () => {
    const msgs = [
      { type: 'idle', outcome: 'failed', error: { type: 'provider.invalid-request', message: 'max tokens too high' } },
      { type: 'assistant', content: [], error: { message: 'max tokens too high' } },
    ]
    expect(resultOf(msgs)).toEqual({ done: true, failed: true, text: '', error: 'max tokens too high' })
    expect(resultOf([{ type: 'idle', outcome: 'interrupted' }])).toMatchObject({
      failed: true,
      error: 'run interrupted',
    })
  })
})

describe('parseSseEvent', () => {
  it('flattens an event and skips heartbeats', () => {
    const block =
      'data: {"id":"evt_1","type":"session.execution.succeeded","location":{"directory":"/w/a"},"data":{"sessionID":"ses_1"}}'
    expect(parseSseEvent(block)).toEqual({ type: 'session.execution.succeeded', sessionID: 'ses_1', directory: '/w/a' })
    expect(parseSseEvent(': heartbeat')).toBeNull()
    expect(parseSseEvent('data: not json')).toBeNull()
  })
})

describe('OpencodeClient', () => {
  it('uses the opencode user for Basic auth', () => {
    expect(opencodeAuthHeader('secret')).toBe(`Basic ${Buffer.from('opencode:secret').toString('base64')}`)
    expect(opencodeAuthHeader('')).toBeUndefined()
  })

  it('creates a session with its location, agent and model, then names it', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ data: { id: 'ses_1' } }))
    vi.stubGlobal('fetch', fetchMock)
    const client = new OpencodeClient({ baseUrl: 'http://oc.test/', password: 'pw' })
    const id = await client.createSession('/w/a', '[job] x', { agent: 'job', model: 'scaleway/glm-5.2' })
    expect(id).toBe('ses_1')
    const [create, rename] = fetchMock.mock.calls
    expect(create?.[0]).toBe('http://oc.test/api/session')
    expect(JSON.parse(typeof create?.[1]?.body === 'string' ? create[1].body : '')).toEqual({
      location: { directory: '/w/a' },
      agent: 'job',
      model: { providerID: 'scaleway', id: 'glm-5.2' },
    })
    expect(new Headers(create?.[1]?.headers).get('authorization')).toBe(opencodeAuthHeader('pw'))
    expect(rename?.[0]).toBe('http://oc.test/api/session/ses_1')
    expect(rename?.[1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ title: '[job] x' }) })
  })

  it('reads health from the server info', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => Response.json({ version: '2.2.5' })),
    )
    expect(await new OpencodeClient({ baseUrl: 'http://oc.test' }).healthInfo()).toEqual({
      healthy: true,
      version: '2.2.5',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => new Response('no', { status: 401 })),
    )
    expect(await new OpencodeClient({ baseUrl: 'http://oc.test' }).healthInfo()).toBeNull()
  })
})
