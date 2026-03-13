import { afterEach, beforeEach, expect, test } from 'bun:test'
import { createApiClient, DEFAULT_API_URL, getApiBaseUrl } from '../../src/lib/client'
import { createMockServer } from '../helpers/mock-server'
import { testConfig, testNonceResponse } from '../helpers/fixtures'

let server = createMockServer([])
let previousApiUrl: string | undefined

afterEach(() => {
  server.stop()

  if (previousApiUrl !== undefined) {
    process.env.HSTORAGE_API_URL = previousApiUrl
  } else {
    delete process.env.HSTORAGE_API_URL
  }
})

beforeEach(() => {
  previousApiUrl = process.env.HSTORAGE_API_URL
  delete process.env.HSTORAGE_API_URL
})

test('returns default base URL when env var is not set', () => {
  expect(getApiBaseUrl()).toBe(DEFAULT_API_URL)
})

test('returns env base URL when HSTORAGE_API_URL is set', () => {
  process.env.HSTORAGE_API_URL = 'http://localhost:1234'

  expect(getApiBaseUrl()).toBe('http://localhost:1234')
})

test('generates nonce by calling /api/generate-crypto-key', async () => {
  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
    {
      method: 'GET',
      path: '/user',
      body: { email: 'test@example.com' },
    },
  ])

  const client = createApiClient(testConfig, { baseUrl: server.url })

  await client.get<{ email: string }>('/user')

  expect(server.requests[0]).toMatchObject({
    method: 'POST',
    path: '/api/generate-crypto-key',
    body: {
      api_key: testConfig.apiKey,
      secret_key: testConfig.secretKey,
    },
  })
})

test('attaches auth headers to requests after nonce is generated', async () => {
  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
    {
      method: 'GET',
      path: '/user',
      body: { ok: true },
    },
  ])

  const client = createApiClient(testConfig, { baseUrl: server.url })

  await client.get('/user')

  expect(server.requests[1]).toMatchObject({
    method: 'GET',
    path: '/user',
  })
  expect(server.requests[1].headers['x-eu-api-key']).toBe(testConfig.apiKey)
  expect(server.requests[1].headers['x-eu-email']).toBe(testConfig.email)
  expect(server.requests[1].headers['x-eu-nonce']).toBe(testNonceResponse.nonce)
})

test('reuses cached nonce for subsequent requests in same client instance', async () => {
  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
    {
      method: 'GET',
      path: '/user',
      body: { ok: true },
    },
    {
      method: 'POST',
      path: '/user',
      body: { ok: true },
    },
  ])

  const client = createApiClient(testConfig, { baseUrl: server.url })

  await client.get('/user')
  await client.post('/user', { status: 'active' })

  const nonceCalls = server.requests.filter((request) => request.path === '/api/generate-crypto-key')

  expect(nonceCalls).toHaveLength(1)
  expect(server.requests[1].headers['x-eu-nonce']).toBe(testNonceResponse.nonce)
  expect(server.requests[2].headers['x-eu-nonce']).toBe(testNonceResponse.nonce)
})

test('makes GET request with query params', async () => {
  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
    {
      method: 'GET',
      path: '/files',
      body: { files: [] },
    },
  ])

  const client = createApiClient(testConfig, { baseUrl: server.url })
  const response = await client.get<{ files: unknown[] }>('/files', {
    limit: '20',
    offset: '0',
  })

  expect(response).toEqual({ files: [] })
  expect(server.requests[1]).toMatchObject({
    method: 'GET',
    path: '/files',
  })
  expect(server.requests[1].headers['x-eu-api-key']).toBe(testConfig.apiKey)
  expect(server.requests[1].headers['x-eu-email']).toBe(testConfig.email)
  expect(server.requests[1].headers['x-eu-nonce']).toBe(testNonceResponse.nonce)
  expect(server.requests[1].body).toBeNull()
})

test('makes POST request with body payload', async () => {
  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
    {
      method: 'POST',
      path: '/files',
      body: { created: true },
    },
  ])

  const client = createApiClient(testConfig, { baseUrl: server.url })
  const response = await client.post<{ created: boolean }>('/files', { name: 'document' })

  expect(response).toEqual({ created: true })
  expect(server.requests[1]).toMatchObject({
    method: 'POST',
    path: '/files',
    body: { name: 'document' },
  })
  expect(server.requests[1].headers['x-eu-api-key']).toBe(testConfig.apiKey)
  expect(server.requests[1].headers['x-eu-email']).toBe(testConfig.email)
  expect(server.requests[1].headers['x-eu-nonce']).toBe(testNonceResponse.nonce)
})

test('makes PUT request with body payload', async () => {
  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
    {
      method: 'PUT',
      path: '/files/abc',
      body: { ok: true },
    },
  ])

  const client = createApiClient(testConfig, { baseUrl: server.url })
  const response = await client.put<{ ok: boolean }>('/files/abc', { title: 'updated' })

  expect(response).toEqual({ ok: true })
  expect(server.requests[1]).toMatchObject({
    method: 'PUT',
    path: '/files/abc',
    body: { title: 'updated' },
  })
  expect(server.requests[1].headers['x-eu-api-key']).toBe(testConfig.apiKey)
  expect(server.requests[1].headers['x-eu-email']).toBe(testConfig.email)
  expect(server.requests[1].headers['x-eu-nonce']).toBe(testNonceResponse.nonce)
})

test('makes DELETE request with query params', async () => {
  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
    {
      method: 'DELETE',
      path: '/files/abc',
      body: { removed: true },
    },
  ])

  const client = createApiClient(testConfig, { baseUrl: server.url })
  const response = await client.delete<{ removed: boolean }>('/files/abc', {
    reason: 'cleanup',
  })

  expect(response).toEqual({ removed: true })
  expect(server.requests[1]).toMatchObject({
    method: 'DELETE',
    path: '/files/abc',
  })
  expect(server.requests[1].headers['x-eu-api-key']).toBe(testConfig.apiKey)
  expect(server.requests[1].headers['x-eu-email']).toBe(testConfig.email)
  expect(server.requests[1].headers['x-eu-nonce']).toBe(testNonceResponse.nonce)
  expect(server.requests[1].path).toBe('/files/abc')
  expect(server.requests[1].body).toBeNull()
})

test('throws parsed ApiError for API error response', async () => {
  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
    {
      method: 'GET',
      path: '/files',
      status: 400,
      body: {
        error: {
          code: 'invalid_request',
          message: 'Bad request',
        },
      },
    },
  ])

  const client = createApiClient(testConfig, { baseUrl: server.url })

  await expect(client.get('/files')).rejects.toThrow('Bad request')
})

test('throws rate limit error with retry_after', async () => {
  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
    {
      method: 'GET',
      path: '/files',
      status: 429,
      body: {
        error: 'api_free_rate_limit_exceeded',
        message: 'Too many requests',
        retry_after: 45,
      },
    },
  ])

  const client = createApiClient(testConfig, { baseUrl: server.url })
  const result = await client.get('/files').then(
    () => ({
      ok: true as const,
    }),
    (error: unknown) => ({
      ok: false as const,
      error,
    }),
  )

  expect(result.ok).toBe(false)
  if (result.ok === false) {
    expect(result.error).toMatchObject({
      message: 'Too many requests',
      retry_after: 45,
    })
  }
})
