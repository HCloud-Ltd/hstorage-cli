import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Cli } from 'incur'
import { createMockServer } from '../helpers/mock-server'
import { testConfig, testNonceResponse } from '../helpers/fixtures'
import { hasConfig, loadConfig, saveConfig } from '../../src/lib/config'
import { authCli } from '../../src/commands/auth'

let server = createMockServer([])
let tmpDir = ''
let originalXDG: string | undefined
let originalApiUrl: string | undefined

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-auth-test-'))
  originalXDG = process.env.XDG_CONFIG_HOME
  originalApiUrl = process.env.HSTORAGE_API_URL
  process.env.XDG_CONFIG_HOME = tmpDir
})

afterEach(async () => {
  server.stop()

  if (originalXDG === undefined) {
    delete process.env.XDG_CONFIG_HOME
  } else {
    process.env.XDG_CONFIG_HOME = originalXDG
  }

  if (originalApiUrl === undefined) {
    delete process.env.HSTORAGE_API_URL
  } else {
    process.env.HSTORAGE_API_URL = originalApiUrl
  }

  await rm(tmpDir, { recursive: true, force: true })
})

function buildCli() {
  const testCli = Cli.create('test').command(authCli)

  return testCli
}

async function runAuthCommand(args: string[]) {
  const outputs: string[] = []
  let exitCode = 0
  let exitCalled = false

  await buildCli().serve(args, {
    exit: (code) => {
      exitCalled = true
      exitCode = code
    },
    stdout: (s) => {
      outputs.push(s)
    },
  })

  return {
    output: outputs.join(''),
    exitCalled,
    exitCode,
  }
}

test('login success saves credentials and returns email', async () => {
  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
  ])
  process.env.HSTORAGE_API_URL = server.url

  const response = await runAuthCommand([
    'auth',
    'login',
    '--email',
    testConfig.email,
    '--api-key',
    testConfig.apiKey,
    '--secret-key',
    testConfig.secretKey,
    '--format',
    'json',
  ])

  expect(response.exitCalled).toBe(false)

  const payload = JSON.parse(response.output)

  expect(payload).toEqual({
    message: 'Logged in successfully',
    email: testConfig.email,
  })

  expect(server.requests).toMatchObject([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: {
        api_key: testConfig.apiKey,
        secret_key: testConfig.secretKey,
      },
    },
  ])

  expect(await loadConfig()).toEqual(testConfig)
})

test('login failure with invalid credentials returns INVALID_CREDENTIALS', async () => {
  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      status: 401,
      body: {
        error: {
          code: 'invalid_credentials',
          message: 'Bad credentials',
        },
      },
    },
  ])
  process.env.HSTORAGE_API_URL = server.url

  const response = await runAuthCommand([
    'auth',
    'login',
    '--email',
    testConfig.email,
    '--api-key',
    'wrong-key',
    '--secret-key',
    'wrong-secret',
    '--format',
    'json',
  ])

  expect(response.exitCalled).toBe(true)
  expect(response.exitCode).toBe(1)

  const payload = JSON.parse(response.output)

  expect(payload).toEqual({
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid credentials',
  })

  expect(await hasConfig()).toBe(false)
})

test('logout success calls API and removes credentials', async () => {
  await saveConfig(testConfig)
  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
    {
      method: 'POST',
      path: '/user/logout',
      body: { ok: true },
    },
  ])
  process.env.HSTORAGE_API_URL = server.url

  const response = await runAuthCommand(['auth', 'logout', '--format', 'json'])

  expect(response.exitCalled).toBe(false)

  const payload = JSON.parse(response.output)
  expect(payload).toEqual({ message: 'Logged out successfully' })

  expect(server.requests).toHaveLength(2)
  expect(server.requests[1]).toMatchObject({
    method: 'POST',
    path: '/user/logout',
  })
  expect(await hasConfig()).toBe(false)
})

test('logout returns Not logged in when credentials are missing', async () => {
  server = createMockServer([])

  const response = await runAuthCommand(['auth', 'logout', '--format', 'json'])

  expect(response.exitCalled).toBe(true)
  expect(response.exitCode).toBe(1)

  const payload = JSON.parse(response.output)

  expect(payload).toEqual({
    code: 'NOT_LOGGED_IN',
    message: 'Not logged in',
  })
})

test('status success when credentials exist', async () => {
  await saveConfig(testConfig)

  const response = await runAuthCommand(['auth', 'status', '--format', 'json'])

  expect(response.exitCalled).toBe(false)

  const payload = JSON.parse(response.output)

  expect(payload).toEqual({
    loggedIn: true,
    email: testConfig.email,
  })
})

test('status returns logged out when credentials are missing', async () => {
  const response = await runAuthCommand(['auth', 'status', '--format', 'json'])

  expect(response.exitCalled).toBe(false)

  const payload = JSON.parse(response.output)

  expect(payload).toEqual({ loggedIn: false })
})
