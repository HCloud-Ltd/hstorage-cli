import { afterEach, beforeEach, expect, test } from 'bun:test'
import {
  loadE2EEnv,
  runCli,
  parseJsonOutput,
  setupE2EContext,
  teardownE2EContext,
  type E2EContext,
} from './helpers'

let ctx: E2EContext | undefined

beforeEach(async () => {
  ctx = await setupE2EContext()
})

afterEach(async () => {
  await teardownE2EContext(ctx)
})

test('auth login -> status -> logout -> status flow', async () => {
  const env = loadE2EEnv()

  const logoutFirst = await runCli(['auth', 'logout', '--format', 'json'])

  const loginResult = await runCli([
    'auth',
    'login',
    '--email',
    env.email,
    '--api-key',
    env.apiKey,
    '--secret-key',
    env.secretKey,
    '--format',
    'json',
  ])
  const loginOutput = parseJsonOutput<{ message: string; email: string }>(loginResult.output)

  expect(loginResult.exitCalled).toBe(false)
  expect(loginOutput.message).toBe('Logged in successfully')
  expect(loginOutput.email).toBe(env.email)

  const statusResult = await runCli(['auth', 'status', '--format', 'json'])
  const statusOutput = parseJsonOutput<{ loggedIn: boolean; email?: string }>(statusResult.output)

  expect(statusResult.exitCalled).toBe(false)
  expect(statusOutput.loggedIn).toBe(true)
  expect(statusOutput.email).toBe(env.email)

  const logoutResult = await runCli(['auth', 'logout', '--format', 'json'])
  const logoutOutput = parseJsonOutput<{ message: string }>(logoutResult.output)

  expect(logoutResult.exitCalled).toBe(false)
  expect(logoutOutput.message).toBe('Logged out successfully')

  const statusAfterLogout = await runCli(['auth', 'status', '--format', 'json'])
  const statusAfterOutput = parseJsonOutput<{ loggedIn: boolean }>(statusAfterLogout.output)

  expect(statusAfterLogout.exitCalled).toBe(false)
  expect(statusAfterOutput.loggedIn).toBe(false)
}, 30_000)
