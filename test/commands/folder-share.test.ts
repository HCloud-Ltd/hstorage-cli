import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Cli, middleware } from 'incur'
import { createMockServer, type Route } from '../helpers/mock-server'
import {
  testConfig,
  testFolderShare,
  testSharedFolderItem,
} from '../helpers/fixtures'
import { authVars } from '../../src/middleware/auth'
import { createApiClient } from '../../src/lib/client'
import { folderShareCli } from '../../src/commands/folder/share'

let server: ReturnType<typeof createMockServer> | null = null

afterEach(() => {
  if (server !== null) {
    server.stop()
    server = null
  }
})

function getServer(): NonNullable<typeof server> {
  if (server === null) {
    throw new Error('Mock server is not initialized')
  }

  return server
}

function setupCli(routes: Route[]) {
  server = createMockServer([
    ...routes,
  ])

  const client = createApiClient(testConfig, { baseUrl: server.url })

  return Cli.create('test', { vars: authVars })
    .use(middleware<typeof authVars>(async (c, next) => {
      c.set('client', client)
      return next()
    }))
    .command(folderShareCli)
}

async function runFolderShareCommand(args: string[], routes: Route[]) {
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

test('shares lists shares for folder', async () => {
  const response = await runFolderShareCommand(
    ['folder-share', 'shares', '--folder-uid', 'folder-uid-abc', '--format', 'json'],
    [
      {
        method: 'GET',
        path: '/folder/folder-uid-abc/shares',
        body: {
          shares: [testFolderShare],
          total: 1,
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.shares).toHaveLength(1)
  expect(payload.shares[0]).toMatchObject({
    uid: testFolderShare.uid,
    shared_to_email: testFolderShare.shared_to_email,
  })
  expect(getServer().requests[0]).toMatchObject({
    method: 'GET',
    path: '/folder/folder-uid-abc/shares',
  })
})

test('share creates folder share with provided permission', async () => {
  const response = await runFolderShareCommand(
    [
      'folder-share',
      'share',
      '--folder-uid',
      'folder-uid-abc',
      '--email',
      'guest@example.com',
      '--permission',
      'edit',
      '--format',
      'json',
    ],
    [
      {
        method: 'PUT',
        path: '/folder/folder-uid-abc/share',
        body: {
          ...testFolderShare,
          permission: 'edit',
          shared_to_email: 'guest@example.com',
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.shared_to_email).toBe('guest@example.com')
  expect(payload.permission).toBe('edit')
  expect(getServer().requests[0]).toMatchObject({
    method: 'PUT',
    path: '/folder/folder-uid-abc/share',
    body: {
      email: 'guest@example.com',
      permission: 'edit',
    },
  })
})

test('update-share updates permission', async () => {
  const response = await runFolderShareCommand(
    [
      'folder-share',
      'update-share',
      '--folder-uid',
      'folder-uid-abc',
      '--share-id',
      'share-uid-001',
      '--permission',
      'admin',
      '--format',
      'json',
    ],
    [
      {
        method: 'PUT',
        path: '/folder/folder-uid-abc/share/share-uid-001',
        body: {
          ...testFolderShare,
          permission: 'admin',
          uid: 'share-uid-001',
          folder_uid: 'folder-uid-abc',
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.uid).toBe('share-uid-001')
  expect(payload.permission).toBe('admin')
  expect(getServer().requests[0]).toMatchObject({
    method: 'PUT',
    path: '/folder/folder-uid-abc/share/share-uid-001',
    body: {
      permission: 'admin',
    },
  })
})

test('remove-share deletes share entry', async () => {
  const response = await runFolderShareCommand(
    [
      'folder-share',
      'remove-share',
      '--folder-uid',
      'folder-uid-abc',
      '--share-id',
      'share-uid-001',
      '--format',
      'json',
    ],
    [
      {
        method: 'DELETE',
        path: '/folder/folder-uid-abc/share/share-uid-001',
        body: { ok: true },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.ok).toBe(true)
  expect(getServer().requests[0]).toMatchObject({
    method: 'DELETE',
    path: '/folder/folder-uid-abc/share/share-uid-001',
    body: null,
  })
})

test('shared-folders lists folders shared with me', async () => {
  const response = await runFolderShareCommand(
    ['folder-share', 'shared-folders', '--format', 'json'],
    [
      {
        method: 'GET',
        path: '/folders/shared',
        body: {
          folders: [testSharedFolderItem],
          total: 1,
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.folders).toHaveLength(1)
  expect(payload.folders[0]).toMatchObject({
    folder_uid: testSharedFolderItem.folder_uid,
    permission: testSharedFolderItem.permission,
  })
  expect(getServer().requests[0]).toMatchObject({
    method: 'GET',
    path: '/folders/shared',
  })
})

test('command fails without authentication client', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-test-'))
  const originalXDG = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = tmpDir

  try {
    const outputs: string[] = []
    let exitCalled = false
    let exitCode = 0

    await Cli.create('test', { vars: authVars }).command(folderShareCli).serve(
      ['folder-share', 'shares', '--folder-uid', 'folder-uid-abc', '--format', 'json'],
      {
        stdout: (s) => {
          outputs.push(s)
        },
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
