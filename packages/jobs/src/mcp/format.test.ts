import { describe, expect, it } from 'vitest'

import { definedOnly, safe } from './format.js'

describe('safe', () => {
  it('answers with the result as pretty JSON', async () => {
    const res = await safe(async () => ({ a: 1 }))({})
    expect(res).toEqual({ content: [{ type: 'text', text: '{\n  "a": 1\n}' }] })
  })

  it('answers plain text as-is', async () => {
    const res = await safe(async () => 'Done.')({})
    expect(res.content).toEqual([{ type: 'text', text: 'Done.' }])
  })

  it('turns a thrown error into an error result', async () => {
    const res = await safe(async () => {
      throw new Error('nope')
    })({})
    expect(res).toEqual({ isError: true, content: [{ type: 'text', text: 'nope' }] })
  })
})

describe('definedOnly', () => {
  it('drops undefined values', () => {
    expect(definedOnly({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null })
  })
})
