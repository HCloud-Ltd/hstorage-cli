import { afterEach, expect, test } from 'bun:test'
import { rm, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { middleware } from 'incur'
import { createMockServer, type Route } from '../helpers/mock-server'
import { testConfig } from '../helpers/fixtures'
import { authVars } from '../../src/middleware/auth'
import { createApiClient } from '../../src/lib/client'
import { uploadCli } from '../../src/commands/file/upload'

let server = createMockServer([])
let tmpDir = ''

const testPresignedBase = {
  external_id: 'ext_test123',
  file_name: 'test.txt',
  share_url: 'https://hstorage.io/f/test123',
  direct_url: 'https://cdn.hstorage.io/test.txt',
}

afterEach(async () => {
  server.stop()

  if (tmpDir !== '') {
    await rm(tmpDir, { recursive: true, force: true })
  }

  tmpDir = ''
})

function setupCli(routes: Route[]) {
  server = createMockServer([
    ...routes,
  ])

  for (const route of routes) {
    if (route.path !== '/upload/v1/presigned') {
      continue
    }

    if (typeof route.body === 'object' && route.body !== null) {
      const body = route.body as Record<string, unknown>

      if ('presigned_url' in body) {
        body.presigned_url = `${server.url}/test-bucket/test-key`
      }
    }
  }

  const mockClient = createApiClient(testConfig, { baseUrl: server.url })

  return uploadCli.use(
    middleware<typeof authVars>(async (c, next) => {
      c.set('client', mockClient)
      return next()
    }),
  )
}

async function runUploadCommand(args: string[], routes: Route[]) {
  const outputs: string[] = []
  let exitCalled = false
  let exitCode = 0

  await setupCli(routes).serve(args, {
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

test('uploads a file successfully and returns share URLs', async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-upload-success-'))
  const testFile = join(tmpDir, 'test.txt')
  await writeFile(testFile, 'hello world')

  const response = await runUploadCommand(
    [testFile, '--format', 'json'],
    [
      {
        method: 'POST',
        path: '/upload/v1/presigned',
        body: {
          ...testPresignedBase,
          presigned_url: '',
        },
      },
      {
        method: 'PUT',
        path: '/test-bucket/test-key',
        body: {},
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toMatchObject(testPresignedBase)
  expect(JSON.stringify(payload)).not.toContain('presigned_url')
  expect(server.requests).toHaveLength(2)
  expect(server.requests[0]).toMatchObject({
    method: 'POST',
    path: '/upload/v1/presigned',
    body: {
      file_name: 'test.txt',
      is_guest: false,
      is_encrypt: false,
    },
  })
  expect(server.requests[1]).toMatchObject({
    method: 'PUT',
    path: '/test-bucket/test-key',
  })
})

test('returns FILE_NOT_FOUND for missing file', async () => {
  const response = await runUploadCommand(
    ['/tmp/this_file_does_not_exist.txt', '--format', 'json'],
    [],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(true)
  expect(response.exitCode).toBe(1)
  expect(payload).toEqual({
    code: 'FILE_NOT_FOUND',
    message: 'File not found: /tmp/this_file_does_not_exist.txt',
  })
  expect(server.requests).toHaveLength(0)
})

test('uploads with options and sends presigned request parameters', async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-upload-options-'))
  const testFile = join(tmpDir, 'option.txt')
  await writeFile(testFile, 'hello with options')

  const deleteDate = '2026-12-31T23:59:59Z'

  const response = await runUploadCommand(
    [
      testFile,
      '--download-limit-count',
      '12',
      '--password',
      'secret',
      '--delete-date',
      deleteDate,
      '--folder-uid',
      'folder-abc',
      '--format',
      'json',
    ],
    [
      {
        method: 'POST',
        path: '/upload/v1/presigned',
        body: {
          ...testPresignedBase,
          presigned_url: '',
          file_name: 'option.txt',
        },
      },
      {
        method: 'PUT',
        path: '/test-bucket/test-key',
        body: {},
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toMatchObject({
    ...testPresignedBase,
    file_name: 'option.txt',
  })
  expect(server.requests).toHaveLength(2)
  expect(server.requests[0]).toMatchObject({
    method: 'POST',
    path: '/upload/v1/presigned',
    body: {
      file_name: 'option.txt',
      is_guest: false,
      is_encrypt: false,
      download_limit_count: 12,
      password: 'secret',
      delete_date: deleteDate,
      folder_uid: 'folder-abc',
    },
  })
})

test('returns error when presigned URL request fails', async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-upload-request-fail-'))
  const testFile = join(tmpDir, 'upload.txt')
  await writeFile(testFile, 'hello fail')

  const response = await runUploadCommand(
    [testFile, '--format', 'json'],
    [
      {
        method: 'POST',
        path: '/upload/v1/presigned',
        status: 500,
        body: {
          error: {
            code: 'service_unavailable',
            message: 'Unable to prepare upload',
          },
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(true)
  expect(response.exitCode).toBe(1)
  expect(payload).toEqual({
    code: 'UPLOAD_REQUEST_FAILED',
    message: 'Unable to prepare upload',
  })
  expect(server.requests).toHaveLength(1)
  expect(server.requests[0]).toMatchObject({
    method: 'POST',
    path: '/upload/v1/presigned',
  })
})

test('returns error when upload to presigned URL fails', async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-upload-put-fail-'))
  const testFile = join(tmpDir, 'upload.txt')
  await writeFile(testFile, 'hello fail')

  const response = await runUploadCommand(
    [testFile, '--format', 'json'],
    [
      {
        method: 'POST',
        path: '/upload/v1/presigned',
        body: {
          ...testPresignedBase,
          presigned_url: '',
        },
      },
      {
        method: 'PUT',
        path: '/test-bucket/test-key',
        status: 500,
        body: {
          error: 'Upload failed',
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(true)
  expect(response.exitCode).toBe(1)
  expect(payload.code).toBe('UPLOAD_FAILED')
  expect(payload.message).toMatch(/^Upload failed:/)
  expect(server.requests).toHaveLength(2)
  expect(server.requests[1]).toMatchObject({
    method: 'PUT',
    path: '/test-bucket/test-key',
  })
})
