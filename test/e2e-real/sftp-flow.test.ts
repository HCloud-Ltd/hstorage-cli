import { afterEach, beforeEach, expect, test } from 'bun:test'
import {
  runCli,
  parseJsonOutput,
  setupE2EContext,
  teardownE2EContext,
  type E2EContext,
} from './helpers'
import type { OkResponse } from '../../src/types/api'

let ctx: E2EContext | undefined

beforeEach(async () => {
  ctx = await setupE2EContext()
})

afterEach(async () => {
  await teardownE2EContext(ctx)
})

test('sftp permission toggle insecure -> reset', async () => {
  const enableResult = await runCli([
    'sftp',
    'permission',
    '--insecure',
    'true',
    '--format',
    'json',
  ])

  if (enableResult.exitCalled) {
    expect(enableResult.exitCode).not.toBe(0)
    return
  }

  const enableOutput = parseJsonOutput<OkResponse>(enableResult.output)
  expect(enableOutput.ok).toBe(true)

  const resetResult = await runCli([
    'sftp',
    'permission',
    '--insecure',
    'false',
    '--format',
    'json',
  ])
  const resetOutput = parseJsonOutput<OkResponse>(resetResult.output)

  expect(resetResult.exitCalled).toBe(false)
  expect(resetOutput.ok).toBe(true)
}, 30_000)
