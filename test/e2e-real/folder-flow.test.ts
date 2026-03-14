import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test'
import {
  loadE2EEnv,
  runCli,
  parseJsonOutput,
  uniqueName,
  cleanupFolder,
  setupE2EContext,
  teardownE2EContext,
  type E2EContext,
  type E2ERealEnv,
} from './helpers'
import type { Folder, FolderTreeResponse, FolderResponse } from '../../src/types/api'

let ctx: E2EContext | undefined
let env: E2ERealEnv
let createdFolderId: number | undefined
let createdFolderUid: string | undefined

beforeEach(async () => {
  ctx = await setupE2EContext()
  env = await loadE2EEnv()
  createdFolderId = undefined
  createdFolderUid = undefined
})

afterEach(async () => {
  if (createdFolderId) {
    await cleanupFolder(env, createdFolderId)
  }
  await teardownE2EContext(ctx)
})

test('folder create -> list -> get -> update -> delete flow', async () => {
  const folderName = uniqueName('e2e-folder')

  const createResult = await runCli([
    'folder',
    'create',
    '--name',
    folderName,
    '--public-view',
    'true',
    '--format',
    'json',
  ])
  const created = parseJsonOutput<Folder>(createResult.output)

  expect(createResult.exitCalled).toBe(false)
  expect(created.name).toBe(folderName)
  expect(created.uid).toBeDefined()
  expect(created.id).toBeDefined()
  expect(created.is_public_view).toBe(true)

  createdFolderId = created.id
  createdFolderUid = created.uid

  const listResult = await runCli(['folder', 'list', '--format', 'json'])
  const listOutput = parseJsonOutput<FolderTreeResponse>(listResult.output)

  expect(listResult.exitCalled).toBe(false)
  expect(listOutput.folders).toBeDefined()
  const found = listOutput.folders?.find((f) => f.uid === createdFolderUid)
  expect(found).toBeDefined()

  const getResult = await runCli(['folder', 'get', createdFolderUid!, '--format', 'json'])
  const getOutput = parseJsonOutput<FolderResponse>(getResult.output)

  expect(getResult.exitCalled).toBe(false)
  expect(getOutput.folder?.uid).toBe(createdFolderUid)
  expect(getOutput.folder?.name).toBe(folderName)

  const updatedName = uniqueName('e2e-folder-updated')
  const updateResult = await runCli([
    'folder',
    'update',
    '--id',
    String(createdFolderId),
    '--name',
    updatedName,
    '--format',
    'json',
  ])
  const updated = parseJsonOutput<Folder>(updateResult.output)

  expect(updateResult.exitCalled).toBe(false)
  expect(updated.name).toBe(updatedName)

  const deleteResult = await runCli([
    'folder',
    'delete',
    '--id',
    String(createdFolderId),
    '--confirm',
    'true',
    '--format',
    'json',
  ])

  expect(deleteResult.exitCalled).toBe(false)
  createdFolderId = undefined
}, 60_000)
