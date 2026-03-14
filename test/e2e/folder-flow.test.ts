import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveConfig } from '../../src/lib/config'
import { createMockServer } from '../helpers/mock-server'
import { testConfig, testFolder, testFolderShare, testFolderTreeResponse } from '../helpers/fixtures'
import { cli } from '../../src/index'

let server = createMockServer([])
let tmpDir = ''
let originalXDG: string | undefined
let originalApiUrl: string | undefined

const createdFolder = {
  ...testFolder,
  id: 20,
  uid: 'folder-e2e',
  name: 'E2E Folder',
  is_public_view: true,
  is_public_upload: true,
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-folder-flow-'))
  originalXDG = process.env.XDG_CONFIG_HOME
  originalApiUrl = process.env.HSTORAGE_API_URL
  process.env.XDG_CONFIG_HOME = tmpDir
  await saveConfig(testConfig)
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

beforeEach(() => {
  server = createMockServer([
    {
      method: 'PUT',
      path: '/folder',
      body: createdFolder,
    },
    {
      method: 'GET',
      path: '/folders',
      body: testFolderTreeResponse,
    },
    {
      method: 'POST',
      path: '/folder',
      body: {
        ...createdFolder,
        name: 'Updated E2E Folder',
      },
    },
    {
      method: 'PUT',
      path: '/folder/folder-e2e/share',
      body: {
        ...testFolderShare,
        shared_to_email: 'guest@example.com',
        permission: 'edit',
      },
    },
    {
      method: 'DELETE',
      path: '/folder',
      body: {
        ok: true,
      },
    },
  ])
  process.env.HSTORAGE_API_URL = server.url
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

test('folder create -> list -> update -> share -> delete flow', async () => {
  const createResult = await runCli([
    'folder',
    'create',
    '--name',
    'E2E Folder',
    '--parent-id',
    '10',
    '--public-view',
    'true',
    '--public-upload',
    'true',
    '--format',
    'json',
  ])
  const createOutput = JSON.parse(createResult.output)

  expect(createResult.exitCalled).toBe(false)
  expect(createOutput).toMatchObject({
    uid: createdFolder.uid,
    name: 'E2E Folder',
    is_public_view: true,
    is_public_upload: true,
  })

  const listResult = await runCli(['folder', 'list', '--format', 'json'])
  const listOutput = JSON.parse(listResult.output)

  expect(listResult.exitCalled).toBe(false)
  expect(listOutput.folders).toHaveLength(1)

  const updateResult = await runCli([
    'folder',
    'update',
    '--id',
    '20',
    '--name',
    'Updated E2E Folder',
    '--format',
    'json',
  ])
  const updateOutput = JSON.parse(updateResult.output)

  expect(updateResult.exitCalled).toBe(false)
  expect(updateOutput.name).toBe('Updated E2E Folder')

  const shareResult = await runCli([
    'folder-share',
    'share',
    '--folder-uid',
    'folder-e2e',
    '--email',
    'guest@example.com',
    '--permission',
    'edit',
    '--format',
    'json',
  ])
  const shareOutput = JSON.parse(shareResult.output)

  expect(shareResult.exitCalled).toBe(false)
  expect(shareOutput.shared_to_email).toBe('guest@example.com')
  expect(shareOutput.permission).toBe('edit')

  const deleteResult = await runCli([
    'folder',
    'delete',
    '--id',
    '20',
    '--confirm',
    'true',
    '--format',
    'json',
  ])
  const deleteOutput = JSON.parse(deleteResult.output)

  expect(deleteResult.exitCalled).toBe(false)
  expect(deleteOutput).toEqual({
    ok: true,
  })

  expect(server.requests).toHaveLength(5)
  expect(server.requests).toMatchObject([
    {
      method: 'PUT',
      path: '/folder',
    },
    {
      method: 'GET',
      path: '/folders',
    },
    {
      method: 'POST',
      path: '/folder',
      body: {
        id: 20,
        name: 'Updated E2E Folder',
      },
    },
    {
      method: 'PUT',
      path: '/folder/folder-e2e/share',
    },
    {
      method: 'DELETE',
      path: '/folder',
      body: null,
    },
  ])
  expect(server.requests[0]).toMatchObject({
    body: {
      name: 'E2E Folder',
      parent_id: 10,
      is_public_view: true,
      is_public_upload: true,
    },
  })
  expect(server.requests[3]).toMatchObject({
    body: {
      email: 'guest@example.com',
      permission: 'edit',
    },
  })
})
