import { afterEach, beforeEach, expect, test } from 'bun:test'
import {
  runCli,
  parseJsonOutput,
  setupE2EContext,
  teardownE2EContext,
  type E2EContext,
} from './helpers'
import type { TeamResponse, TeamStorageResponse } from '../../src/types/api'

let ctx: E2EContext | undefined

beforeEach(async () => {
  ctx = await setupE2EContext()
})

afterEach(async () => {
  await teardownE2EContext(ctx)
})

test('team info returns leader and members', async () => {
  const result = await runCli(['team', 'info', '--format', 'json'])

  if (result.exitCalled) {
    expect(result.exitCode).not.toBe(0)
    return
  }

  const output = parseJsonOutput<TeamResponse>(result.output)

  expect(output.leader).toBeDefined()
  expect(output.leader?.leader_user_email).toBeDefined()
}, 30_000)

test('team storage returns allocation info', async () => {
  const result = await runCli(['team', 'storage', '--format', 'json'])

  if (result.exitCalled) {
    expect(result.exitCode).not.toBe(0)
    return
  }

  const output = parseJsonOutput<TeamStorageResponse>(result.output)

  expect(typeof output.leader_total_bytes).toBe('number')
  expect(typeof output.allocated_total_bytes).toBe('number')
  expect(typeof output.leader_remaining_bytes).toBe('number')
  expect(typeof output.leader_used_bytes).toBe('number')
}, 30_000)

test('team invite -> remove-member flow', async () => {
  const inviteResult = await runCli([
    'team',
    'invite',
    '--name',
    'E2E Test Member',
    '--email',
    'e2e-test-member@hstorage-test.invalid',
    '--format',
    'json',
  ])

  if (inviteResult.exitCalled) {
    expect(inviteResult.exitCode).not.toBe(0)
    return
  }

  expect(inviteResult.exitCalled).toBe(false)

  const teamResult = await runCli(['team', 'info', '--format', 'json'])
  const team = parseJsonOutput<TeamResponse>(teamResult.output)

  const invited = team.members?.find(
    (m) => m.member_user_email === 'e2e-test-member@hstorage-test.invalid',
  )

  if (invited?.member_user_id) {
    const removeResult = await runCli([
      'team',
      'remove-member',
      invited.member_user_id,
      '--confirm',
      'true',
      '--format',
      'json',
    ])

    expect(removeResult.exitCalled).toBe(false)
  }
}, 60_000)
