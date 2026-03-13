import { afterEach, expect, test } from 'bun:test'
import { Cli, middleware } from 'incur'
import { createMockServer, type Route } from '../helpers/mock-server'
import {
  testConfig,
  testNonceResponse,
  testTeamResponse,
  testTeamStorageResponse,
} from '../helpers/fixtures'
import { authVars } from '../../src/middleware/auth'
import { createApiClient } from '../../src/lib/client'
import { teamCli } from '../../src/commands/team'

let server = createMockServer([])

afterEach(() => {
  server.stop()
})

function setupCli(routes: Route[]) {
  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
    ...routes,
  ])

  const client = createApiClient(testConfig, { baseUrl: server.url })

  return Cli.create('test', { vars: authVars })
    .use(
      middleware<typeof authVars>(async (c, next) => {
        c.set('client', client)
        return next()
      }),
    )
    .command(teamCli)
}

async function runTeamCommand(args: string[], routes: Route[]) {
  const outputs: string[] = []
  let exitCalled = false
  let exitCode = 0

  await setupCli(routes).serve(args, {
    stdout: (s) => outputs.push(s),
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

test('info shows team leader and members', async () => {
  const response = await runTeamCommand(
    ['team', 'info', '--format', 'json'],
    [
      {
        method: 'GET',
        path: '/team',
        body: testTeamResponse,
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.leader).toMatchObject({
    leader_user_id: testTeamResponse.leader?.leader_user_id,
    leader_user_email: testTeamResponse.leader?.leader_user_email,
  })
  expect(payload.members).toHaveLength(1)
  expect(payload.members[0]).toMatchObject({
    member_user_id: testTeamResponse.members?.[0]?.member_user_id,
    member_user_email: testTeamResponse.members?.[0]?.member_user_email,
  })
  expect(server.requests).toMatchObject([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
    },
    {
      method: 'GET',
      path: '/team',
    },
  ])
})

test('invite sends invite payload as array', async () => {
  const response = await runTeamCommand(
    [
      'team',
      'invite',
      '--name',
      'New Member',
      '--email',
      'new@example.com',
      '--allocated-storage-bytes',
      '2048',
      '--format',
      'json',
    ],
    [
      {
        method: 'POST',
        path: '/team/invite',
        body: { ok: true },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toEqual({ ok: true })
  expect(server.requests[1]).toMatchObject({
    method: 'POST',
    path: '/team/invite',
    body: [
      {
        name: 'New Member',
        email: 'new@example.com',
        allocated_storage_bytes: 2048,
      },
    ],
  })
})

test('remove-member requires confirm', async () => {
  const response = await runTeamCommand(
    ['team', 'remove-member', 'member-uuid', '--format', 'json'],
    [],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(true)
  expect(response.exitCode).toBe(1)
  expect(payload).toEqual({
    code: 'CONFIRMATION_REQUIRED',
    message: 'Pass --confirm to remove member',
  })
})

test('remove-member deletes member when confirmed', async () => {
  const response = await runTeamCommand(
    [
      'team',
      'remove-member',
      'member-uuid',
      '--confirm',
      'true',
      '--format',
      'json',
    ],
    [
      {
        method: 'DELETE',
        path: '/team/member',
        body: { message: 'Member removed' },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toEqual({ message: 'Member removed' })
  expect(server.requests).toMatchObject([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
    },
    {
      method: 'DELETE',
      path: '/team/member',
      body: null,
    },
  ])
})

test('storage shows team storage info', async () => {
  const response = await runTeamCommand(
    ['team', 'storage', '--format', 'json'],
    [
      {
        method: 'GET',
        path: '/team/storage',
        body: testTeamStorageResponse,
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.leader_total_bytes).toBe(testTeamStorageResponse.leader_total_bytes)
  expect(payload.members).toHaveLength(1)
  expect(payload.members[0]).toMatchObject({
    user_id: testTeamStorageResponse.members?.[0]?.user_id,
    allocated_bytes: testTeamStorageResponse.members?.[0]?.allocated_bytes,
  })
})

test('update-storage sends update body in snake_case', async () => {
  const response = await runTeamCommand(
    [
      'team',
      'update-storage',
      '--user-id',
      'member-uuid',
      '--allocated-storage-bytes',
      '4096',
      '--format',
      'json',
    ],
    [
      {
        method: 'PUT',
        path: '/team/member/storage',
        body: { ok: true },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toEqual({ ok: true })
  expect(server.requests[1]).toMatchObject({
    method: 'PUT',
    path: '/team/member/storage',
    body: {
      user_id: 'member-uuid',
      allocated_storage_bytes: 4096,
    },
  })
})
