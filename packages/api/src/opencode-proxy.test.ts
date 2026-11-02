import http from 'node:http'

import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { opencodeProxy } from './opencode-proxy.js'

const AUTH = `Basic ${Buffer.from('opencode:pw').toString('base64')}`

let upstream: http.Server
let target: string

// A stand-in for opencode v2: Basic auth on everything, and the challenge header on refusal.
beforeEach(async () => {
  upstream = http.createServer((req, res) => {
    if (req.headers.authorization !== AUTH) {
      res.writeHead(401, { 'www-authenticate': 'Basic realm="Secure Area"', 'content-type': 'application/json' })
      res.end('{"_tag":"Unauthorized"}')
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ url: req.url }))
  })
  await new Promise<void>((resolve) => {
    upstream.listen(0, '127.0.0.1', resolve)
  })
  const address = upstream.address()
  if (!address || typeof address === 'string') throw new Error('no port')
  target = `http://127.0.0.1:${address.port}`
})

afterEach(async () => {
  await new Promise((resolve) => {
    upstream.close(resolve)
  })
})

const appWith = (auth?: string) => express().use(opencodeProxy(target, auth))

describe('opencode proxy', () => {
  it("adds opencode's credentials, replacing whatever the browser sent", async () => {
    const res = await request(appWith(AUTH)).get('/api/info?x=1').set('Authorization', 'Basic bm9wZTpub3Bl')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ url: '/api/info?x=1' })
  })

  it("never passes opencode's login challenge on to the browser", async () => {
    const res = await request(appWith()).get('/api/info')
    expect(res.status).toBe(401)
    expect(res.headers['www-authenticate']).toBeUndefined()
  })
})
