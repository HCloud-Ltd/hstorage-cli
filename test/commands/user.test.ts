import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Cli, middleware } from 'incur'
import { createMockServer, type Route } from '../helpers/mock-server'
import { testConfig, testLoginInit } from '../helpers/fixtures'
import { authVars } from '../../src/middleware/auth'
import { createApiClient } from '../../src/lib/client'
import { userCli } from '../../src/commands/user'

let server = createMockServer([])

const updatedUserSettings = {
  enable_auto_delete: true,
  automatic_deletion_seconds: 1800,
  enable_auto_password: true,
  password: 'new-password',
  enable_auto_encryption: true,
  enable_download_notification: true,
}

afterEach(() => {
  server.stop()
})

function setupCli(routes: Route[]) {
  server = createMockServer([
    ...routes,
  ])

  const mockClient = createApiClient(testConfig, { baseUrl: server.url })

  return Cli.create('test', { vars: authVars })
    .use(
      middleware<typeof authVars>(async (c, next) => {
        c.set('client', mockClient)
        return next()
      }),
    )
    .command(userCli)
}

async function runUserCommand(args: string[], routes: Route[]) {
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

test('info shows user data without api.secret', async () => {
  const response = await runUserCommand(
    [
      'user',
      'info',
      '--format',
      'json',
    ],
    [
      {
        method: 'GET',
        path: '/user',
        body: testLoginInit,
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toMatchObject({
    subscription: testLoginInit.subscription,
    usage: testLoginInit.usage,
    storage_limit_bytes: testLoginInit.storage_limit_bytes,
    storage_remaining_bytes: testLoginInit.storage_remaining_bytes,
  })
  expect(response.output).not.toContain(testLoginInit.api.secret)
  expect(server.requests).toMatchObject([
    {
      method: 'GET',
      path: '/user',
    },
  ])
})

test('info fails without client injection', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-test-'))
  const originalXDG = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = tmpDir

  try {
    const outputs: string[] = []
    let exitCalled = false
    let exitCode = 0

    await Cli.create('test', { vars: authVars }).command(userCli).serve(
      ['user', 'info', '--format', 'json'],
      {
        stdout: (s) => outputs.push(s),
        exit: (code) => {
          exitCalled = true
          exitCode = code
        },
      },
    )

    const payload = JSON.parse(outputs.join(''))

    expect(exitCalled).toBe(true)
    expect(exitCode).toBe(1)
    expect(payload).toEqual({
      code: 'AUTH_REQUIRED',
      message: 'Not logged in. Run `hcli auth login` to authenticate.',
    })
  } finally {
    if (originalXDG === undefined) delete process.env.XDG_CONFIG_HOME
    else process.env.XDG_CONFIG_HOME = originalXDG
    await rm(tmpDir, { recursive: true, force: true })
  }
})

test('delete requires confirmation flag', async () => {
  const response = await runUserCommand(['user', 'delete', '--format', 'json'], [])

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(true)
  expect(response.exitCode).toBe(1)
  expect(payload).toEqual({
    code: 'CONFIRMATION_REQUIRED',
    message: 'Pass --confirm to delete your account',
  })
})

test('delete removes account when confirm is true', async () => {
  const response = await runUserCommand(
    [
      'user',
      'delete',
      '--confirm',
      'true',
      '--format',
      'json',
    ],
    [
      {
        method: 'DELETE',
        path: '/user',
        body: {
          message: 'Account deleted successfully',
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toEqual({
    message: 'Account deleted successfully',
  })
  expect(server.requests).toHaveLength(1)
  expect(server.requests[0]).toMatchObject({
    method: 'DELETE',
    path: '/user',
  })
})

test('settings get returns user setting response', async () => {
  const response = await runUserCommand(
    [
      'user',
      'settings-get',
      '--format',
      'json',
    ],
    [
      {
        method: 'GET',
        path: '/user/setting',
        body: {
          enable_auto_delete: true,
          automatic_deletion_seconds: 3600,
          enable_auto_password: false,
          enable_auto_encryption: true,
          enable_download_notification: false,
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toEqual({
    enable_auto_delete: true,
    automatic_deletion_seconds: 3600,
    enable_auto_password: false,
    enable_auto_encryption: true,
    enable_download_notification: false,
  })
  expect(server.requests).toMatchObject([
    {
      method: 'GET',
      path: '/user/setting',
    },
  ])
})

test('settings update sends snake_case body and returns response', async () => {
  const response = await runUserCommand(
    [
      'user',
      'settings-update',
      '--enable-auto-delete',
      'true',
      '--automatic-deletion-seconds',
      '1800',
      '--enable-auto-password',
      'true',
      '--password',
      'new-password',
      '--enable-auto-encryption',
      'true',
      '--enable-download-notification',
      'true',
      '--format',
      'json',
    ],
    [
      {
        method: 'PUT',
        path: '/user/setting',
        body: {
          ...updatedUserSettings,
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toEqual(updatedUserSettings)
  expect(server.requests[0]).toMatchObject({
    method: 'PUT',
    path: '/user/setting',
    body: {
      enable_auto_delete: true,
      automatic_deletion_seconds: 1800,
      enable_auto_password: true,
      password: 'new-password',
      enable_auto_encryption: true,
      enable_download_notification: true,
    },
  })
})
