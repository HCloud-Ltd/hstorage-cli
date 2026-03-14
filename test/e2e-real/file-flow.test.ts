import { afterEach, beforeEach, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  loadE2EEnv,
  runCli,
  parseJsonOutput,
  uniqueName,
  cleanupFile,
  cleanupFolder,
  setupE2EContext,
  teardownE2EContext,
  type E2EContext,
  type E2ERealEnv,
} from './helpers'
import type {
  Folder,
  GetFilesResponse,
  Upload,
} from '../../src/types/api'

let ctx: E2EContext | undefined
let env: E2ERealEnv
let uploadedExternalId: string | undefined
let createdFolderId: number | undefined

beforeEach(async () => {
  ctx = await setupE2EContext()
  env = await loadE2EEnv()
  uploadedExternalId = undefined
  createdFolderId = undefined
})

afterEach(async () => {
  if (uploadedExternalId) {
    await cleanupFile(env, uploadedExternalId)
  }
  if (createdFolderId) {
    await cleanupFolder(env, createdFolderId)
  }
  await teardownE2EContext(ctx)
})

test('file upload -> list -> info -> move -> download -> delete flow', async () => {
  if (!ctx) throw new Error('E2E context not initialized')
  const fileName = `${uniqueName('e2e-test')}.txt`
  const filePath = join(ctx.tmpDir, fileName)
  const fileContent = `E2E test file content: ${Date.now()}`
  await writeFile(filePath, fileContent)

  const uploadResult = await runCli(['file', 'upload', filePath, '--format', 'json'])
  const uploadOutput = parseJsonOutput<{
    external_id: string
    file_name: string
    share_url: string
    direct_url: string
  }>(uploadResult.output)

  expect(uploadResult.exitCalled).toBe(false)
  expect(uploadOutput.external_id).toBeDefined()
  expect(uploadOutput.file_name).toBeDefined()
  expect(uploadOutput.share_url).toBeDefined()

  uploadedExternalId = uploadOutput.external_id

  const listResult = await runCli(['file', 'list', '--format', 'json'])
  const listOutput = parseJsonOutput<GetFilesResponse>(listResult.output)

  expect(listResult.exitCalled).toBe(false)
  expect(listOutput.files).toBeDefined()
  const foundInList = listOutput.files.find((f) => f.external_id === uploadedExternalId)
  expect(foundInList).toBeDefined()

  const infoResult = await runCli(['file', 'info', uploadedExternalId, '--format', 'json'])
  const infoOutput = parseJsonOutput<Upload>(infoResult.output)

  expect(infoResult.exitCalled).toBe(false)
  expect(infoOutput.external_id).toBe(uploadedExternalId)
  expect(infoOutput.original_file_name).toBe(fileName)

  const folderName = uniqueName('e2e-move-target')
  const createFolderResult = await runCli([
    'folder',
    'create',
    '--name',
    folderName,
    '--format',
    'json',
  ])
  const folder = parseJsonOutput<Folder>(createFolderResult.output)
  createdFolderId = folder.id

  const moveResult = await runCli([
    'file',
    'move',
    '--external-id',
    uploadedExternalId,
    '--target-folder-id',
    String(folder.id),
    '--format',
    'json',
  ])
  const moveOutput = parseJsonOutput<Upload>(moveResult.output)

  expect(moveResult.exitCalled).toBe(false)
  expect(moveOutput.external_id).toBe(uploadedExternalId)

  const downloadPath = join(ctx.tmpDir, 'downloaded.txt')
  const downloadResult = await runCli([
    'file',
    'download',
    uploadedExternalId,
    '--output',
    downloadPath,
    '--format',
    'json',
  ])
  const downloadOutput = parseJsonOutput<{
    file_name: string
    original_file_name: string
    saved_to: string
  }>(downloadResult.output)

  expect(downloadResult.exitCalled).toBe(false)
  expect(downloadOutput.saved_to).toBe(downloadPath)
  expect(downloadOutput.original_file_name).toBe(fileName)

  const downloadedContent = await Bun.file(downloadPath).text()
  expect(downloadedContent).toBe(fileContent)

  const deleteResult = await runCli([
    'file',
    'delete',
    uploadedExternalId,
    '--confirm',
    'true',
    '--format',
    'json',
  ])

  expect(deleteResult.exitCalled).toBe(false)
  uploadedExternalId = undefined
}, 120_000)
