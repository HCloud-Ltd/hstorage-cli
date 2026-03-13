import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveConfig } from '../../src/lib/config'
import { createMockServer } from '../helpers/mock-server'
import { testConfig, testGetFilesResponse, testNonceResponse, testUpload } from '../helpers/fixtures'
import { cli } from '../../src/index'

let server = createMockServer([])
let tmpDir = ''
let originalXDG: string | undefined
let originalApiUrl: string | undefined

const e2eExternalId = 'ext_e2e'
const uploadFileName = 'test.txt'
const downloadResponseBody = {
  content: 'downloaded e2e file',
}

const updatedUpload = {
  ...testUpload,
  id: 99,
  external_id: e2eExternalId,
  file_name: uploadFileName,
  original_file_name: uploadFileName,
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-file-flow-'))
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

function setupServer() {
  const presignedResponse = {
    external_id: e2eExternalId,
    file_name: uploadFileName,
    share_url: 'https://example.com/f/e2e',
    direct_url: 'https://cdn.example.com/test.txt',
    pre_signed_url: '',
  }

  const fileInfoResponse = {
    ...updatedUpload,
    download_url: '',
  }

  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
    {
      method: 'POST',
      path: '/upload/v1/presigned',
      body: presignedResponse,
    },
    {
      method: 'PUT',
      path: '/upload-target',
      body: {},
    },
    {
      method: 'GET',
      path: '/files',
      body: {
        ...testGetFilesResponse,
        files: [updatedUpload],
      },
    },
    {
      method: 'GET',
      path: '/file/info',
      body: fileInfoResponse,
    },
    {
      method: 'POST',
      path: '/file/move',
      body: {
        ...updatedUpload,
        target_folder_id: 77,
      },
    },
    {
      method: 'GET',
      path: '/download-target',
      body: downloadResponseBody,
    },
    {
      method: 'DELETE',
      path: '/file/my',
      body: {
        ok: true,
      },
    },
  ])

  presignedResponse.pre_signed_url = `${server.url}/upload-target`
  fileInfoResponse.download_url = `${server.url}/download-target`

  process.env.HSTORAGE_API_URL = server.url
}

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

test('file upload -> list -> info -> move -> download -> delete flow', async () => {
  setupServer()

  const filePath = join(tmpDir, uploadFileName)
  await writeFile(filePath, 'sample upload content')

  const uploadResult = await runCli(['file', 'upload', filePath, '--format', 'json'])
  const uploadOutput = JSON.parse(uploadResult.output)
  expect(uploadResult.exitCalled).toBe(false)
  expect(uploadOutput).toEqual({
    external_id: e2eExternalId,
    file_name: uploadFileName,
    share_url: 'https://example.com/f/e2e',
    direct_url: 'https://cdn.example.com/test.txt',
  })
  expect(uploadOutput.pre_signed_url).toBeUndefined()
  expect(server.requests[1]).toMatchObject({
    method: 'POST',
    path: '/upload/v1/presigned',
    body: {
      file_name: uploadFileName,
      is_guest: false,
      is_encrypt: false,
    },
  })

  const listResult = await runCli(['file', 'list', '--format', 'json'])
  const listOutput = JSON.parse(listResult.output)

  expect(listResult.exitCalled).toBe(false)
  expect(listOutput.files).toHaveLength(1)
  expect(listOutput.files[0].external_id).toBe(e2eExternalId)

  const infoResult = await runCli(['file', 'info', e2eExternalId, '--format', 'json'])
  const infoOutput = JSON.parse(infoResult.output)

  expect(infoResult.exitCalled).toBe(false)
  expect(infoOutput.external_id).toBe(e2eExternalId)
  expect(infoOutput.original_file_name).toBe(uploadFileName)

  const moveResult = await runCli([
    'file',
    'move',
    '--external-id',
    e2eExternalId,
    '--target-folder-id',
    '77',
    '--format',
    'json',
  ])
  const moveOutput = JSON.parse(moveResult.output)

  expect(moveResult.exitCalled).toBe(false)
  expect(moveOutput.external_id).toBe(e2eExternalId)

  const downloadPath = join(tmpDir, 'downloaded.txt')
  const downloadResult = await runCli([
    'file',
    'download',
    e2eExternalId,
    '--output',
    downloadPath,
    '--format',
    'json',
  ])
  const downloadOutput = JSON.parse(downloadResult.output)

  expect(downloadResult.exitCalled).toBe(false)
  expect(downloadOutput.saved_to).toBe(downloadPath)
  expect(downloadOutput.file_name).toBe(uploadFileName)
  expect(downloadOutput.original_file_name).toBe(uploadFileName)
  expect(await Bun.file(downloadPath).text()).toBe(JSON.stringify(downloadResponseBody))

  const deleteResult = await runCli([
    'file',
    'delete',
    e2eExternalId,
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

  expect(server.requests).toHaveLength(14)
  expect(server.requests[0]).toMatchObject({ method: 'POST', path: '/api/generate-crypto-key' })
  expect(server.requests[1]).toMatchObject({ method: 'POST', path: '/upload/v1/presigned' })
  expect(server.requests[2]).toMatchObject({ method: 'PUT', path: '/upload-target' })
  expect(server.requests[3]).toMatchObject({ method: 'POST', path: '/api/generate-crypto-key' })
  expect(server.requests[4]).toMatchObject({ method: 'GET', path: '/files' })
  expect(server.requests[5]).toMatchObject({ method: 'POST', path: '/api/generate-crypto-key' })
  expect(server.requests[6]).toMatchObject({ method: 'GET', path: '/file/info' })
  expect(server.requests[7]).toMatchObject({ method: 'POST', path: '/api/generate-crypto-key' })
  expect(server.requests[8]).toMatchObject({ method: 'POST', path: '/file/move' })
  expect(server.requests[9]).toMatchObject({ method: 'POST', path: '/api/generate-crypto-key' })
  expect(server.requests[10]).toMatchObject({ method: 'GET', path: '/file/info' })
  expect(server.requests[11]).toMatchObject({ method: 'GET', path: '/download-target' })
  expect(server.requests[12]).toMatchObject({ method: 'POST', path: '/api/generate-crypto-key' })
  expect(server.requests[13]).toMatchObject({ method: 'DELETE', path: '/file/my' })
})
