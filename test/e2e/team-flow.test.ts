import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveConfig } from '../../src/lib/config'
import { createMockServer } from '../helpers/mock-server'
import { testConfig, testNonceResponse, testTeamResponse, testTeamStorageResponse } from '../helpers/fixtures'
import { cli } from '../../src/index'

let server = createMockServer([])
let tmpDir = ''
let originalXDG: string | undefined
let originalApiUrl: string | undefined

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-team-flow-'))
  originalXDG = process.env.XDG_CONFIG_HOME
  originalApiUrl = process.env.HSTORAGE_API_URL
  process.env.XDG_CONFIG_HOME = tmpDir
  await saveConfig(testConfig)

  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
    {
      method: 'GET',
      path: '/team',
      body: testTeamResponse,
    },
    {
      method: 'POST',
      path: '/team/invite',
      body: {
        ok: true,
      },
    },
    {
      method: 'GET',
      path: '/team/storage',
      body: testTeamStorageResponse,
    },
    {
      method: 'DELETE',
      path: '/team/member',
      body: {
        message: 'Member removed',
      },
    },
  ])

  process.env.HSTORAGE_API_URL = server.url
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

test('team info -> invite -> storage -> remove-member flow', async () => {
  const infoResult = await runCli(['team', 'info', '--format', 'json'])
  const infoOutput = JSON.parse(infoResult.output)

  expect(infoResult.exitCalled).toBe(false)
  expect(infoOutput.leader).toMatchObject({
    leader_user_id: testTeamResponse.leader?.leader_user_id,
    leader_user_email: testTeamResponse.leader?.leader_user_email,
  })
  expect(infoOutput.members).toHaveLength(1)

  const inviteResult = await runCli([
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
  ])
  const inviteOutput = JSON.parse(inviteResult.output)

  expect(inviteResult.exitCalled).toBe(false)
  expect(inviteOutput).toEqual({
    ok: true,
  })

  const storageResult = await runCli(['team', 'storage', '--format', 'json'])
  const storageOutput = JSON.parse(storageResult.output)

  expect(storageResult.exitCalled).toBe(false)
  expect(storageOutput.leader_total_bytes).toBe(testTeamStorageResponse.leader_total_bytes)
  expect(storageOutput.members).toHaveLength(1)
  expect(storageOutput.members[0].user_id).toBe(testTeamStorageResponse.members?.[0]?.user_id)

  const removeMemberResult = await runCli([
    'team',
    'remove-member',
    'member-uuid',
    '--confirm',
    'true',
    '--format',
    'json',
  ])
  const removeMemberOutput = JSON.parse(removeMemberResult.output)

  expect(removeMemberResult.exitCalled).toBe(false)
  expect(removeMemberOutput).toEqual({
    message: 'Member removed',
  })

  expect(server.requests).toHaveLength(8)
  expect(server.requests).toMatchObject([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
    },
    {
      method: 'GET',
      path: '/team',
    },
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
    },
    {
      method: 'POST',
      path: '/team/invite',
      body: [
        {
          name: 'New Member',
          email: 'new@example.com',
          allocated_storage_bytes: 2048,
        },
      ],
    },
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
    },
    {
      method: 'GET',
      path: '/team/storage',
    },
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
