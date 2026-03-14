import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cli } from '../../src/index'
import { createMockServer } from '../helpers/mock-server'
import { testConfig } from '../helpers/fixtures'

let server = createMockServer([])
let tmpDir = ''
let originalXDG: string | undefined
let originalApiUrl: string | undefined

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-auth-flow-'))
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

async function runCli(argv: string[]) {
  const outputs: string[] = []
  let exitCalled = false
  let exitCode = 0

  await cli.serve(argv, {
    stdout: (s) => {
      outputs.push(s)
    },
    exit: (code) => {
      exitCalled = true
      exitCode = code
    },
  })

  return {
    output: outputs.join(''),
    exitCalled,
    exitCode,
  }
}

test('auth login -> status -> logout -> status flow', async () => {
  server = createMockServer([
    {
      method: 'GET',
      path: '/user',
      body: { email: testConfig.email },
    },
    {
      method: 'POST',
      path: '/user/logout',
      body: { ok: true },
    },
  ])
  process.env.HSTORAGE_API_URL = server.url

  const loginResult = await runCli([
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
  const loginOutput = JSON.parse(loginResult.output)

  expect(loginResult.exitCalled).toBe(false)
  expect(loginOutput).toEqual({
    message: 'Logged in successfully',
    email: testConfig.email,
  })

  const statusResult = await runCli(['auth', 'status', '--format', 'json'])
  const statusOutput = JSON.parse(statusResult.output)

  expect(statusResult.exitCalled).toBe(false)
  expect(statusOutput).toEqual({
    loggedIn: true,
    email: testConfig.email,
  })

  const logoutResult = await runCli(['auth', 'logout', '--format', 'json'])
  const logoutOutput = JSON.parse(logoutResult.output)

  expect(logoutResult.exitCalled).toBe(false)
  expect(logoutOutput).toEqual({
    message: 'Logged out successfully',
  })

  const statusAfterLogout = await runCli(['auth', 'status', '--format', 'json'])
  const statusAfterOutput = JSON.parse(statusAfterLogout.output)

  expect(statusAfterLogout.exitCalled).toBe(false)
  expect(statusAfterOutput).toEqual({
    loggedIn: false,
  })

  expect(server.requests).toMatchObject([
    {
      method: 'GET',
      path: '/user',
    },
    {
      method: 'POST',
      path: '/user/logout',
      body: null,
    },
  ])
  expect(server.requests).toHaveLength(2)
})
