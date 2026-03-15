import { afterEach, expect, test } from 'bun:test'
import { createMockServer } from './mock-server'

let server = createMockServer([])

afterEach(() => {
  server.stop()
})

test('creates server and returns URL', () => {
  server = createMockServer([])

  expect(server.url).toMatch(/^http:\/\/localhost:\d+$/)
})

test('matches route and returns response', async () => {
  server = createMockServer([
    {
      method: 'GET',
      path: '/test',
      body: { data: 'ok' },
    },
  ])

  const response = await fetch(`${server.url}/test`)
  const body = (await response.json()) as { data: string }

  expect(response.status).toBe(200)
  expect(body.data).toBe('ok')
})

test('records requests', async () => {
  server = createMockServer([
    {
      method: 'POST',
      path: '/echo',
      body: { ok: true },
    },
  ])

  const requestBody = { name: 'hstorage' }

  await fetch(`${server.url}/echo`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  expect(server.requests).toHaveLength(1)
  expect(server.requests[0]).toMatchObject({
    method: 'POST',
    path: '/echo',
    body: requestBody,
  })
  expect(server.requests[0].headers['content-type']).toBe('application/json')
})

test('returns 404 for unmatched routes', async () => {
  server = createMockServer([
    {
      method: 'GET',
      path: '/exists',
      body: { ok: true },
    },
  ])

  const response = await fetch(`${server.url}/missing`)

  expect(response.status).toBe(404)
  expect(await response.text()).toBe('Not Found')
})

test('stops server', async () => {
  server = createMockServer([
    {
      method: 'GET',
      path: '/alive',
      body: { ok: true },
    },
  ])

  server.stop()

  await expect(fetch(`${server.url}/alive`)).rejects.toBeDefined()
})
