import { afterEach, beforeEach, expect, test } from 'bun:test'
import {
  runCli,
  parseJsonOutput,
  isDestructiveEnabled,
  setupE2EContext,
  teardownE2EContext,
  type E2EContext,
} from './helpers'
import type { UserSetting } from '../../src/types/api'

let ctx: E2EContext | undefined

beforeEach(async () => {
  ctx = await setupE2EContext()
})

afterEach(async () => {
  await teardownE2EContext(ctx)
})

test('user info returns subscription and usage', async () => {
  const result = await runCli(['user', 'info', '--format', 'json'])
  const output = parseJsonOutput<{
    subscription: string
    usage: { count: number; total_size: number }
    storage_limit_bytes: number
    storage_remaining_bytes: number
  }>(result.output)

  expect(result.exitCalled).toBe(false)
  expect(output.subscription).toBeDefined()
  expect(['free', 'premium', 'business', 'onetime']).toContain(output.subscription)
  expect(output.usage).toBeDefined()
  expect(typeof output.usage.count).toBe('number')
  expect(typeof output.usage.total_size).toBe('number')
  expect(typeof output.storage_limit_bytes).toBe('number')
  expect(typeof output.storage_remaining_bytes).toBe('number')
}, 30_000)

test('user settings-get returns settings', async () => {
  const result = await runCli(['user', 'settings-get', '--format', 'json'])
  const output = parseJsonOutput<UserSetting>(result.output)

  expect(result.exitCalled).toBe(false)
  expect(typeof output.enable_auto_delete).toBe('boolean')
  expect(typeof output.enable_auto_password).toBe('boolean')
  expect(typeof output.enable_auto_encryption).toBe('boolean')
  expect(typeof output.enable_download_notification).toBe('boolean')
}, 30_000)


test('user delete requires HSTORAGE_E2E_DESTRUCTIVE', async () => {
  if (!isDestructiveEnabled()) {
    expect(true).toBe(true)
    return
  }

  const result = await runCli(['user', 'delete', '--confirm', 'true', '--format', 'json'])
  expect(result.exitCalled).toBe(false)
}, 30_000)
