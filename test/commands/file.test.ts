import { afterEach, expect, test } from 'bun:test'
import { Cli, middleware } from 'incur'
import { createMockServer, type Route } from '../helpers/mock-server'
import { testConfig, testGetFilesResponse, testUpload } from '../helpers/fixtures'
import { authVars } from '../../src/middleware/auth'
import { createApiClient } from '../../src/lib/client'
import { fileCli } from '../../src/commands/file'

const testExternalId = testUpload.external_id ?? 'ext_abc123'

let server = createMockServer([])

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
    .command(fileCli)
}

async function runFileCommand(args: string[], routes: Route[]) {
  const outputs: string[] = []
  let exitCalled = false
  let exitCode = 0
  const originalProcessExitCode = process.exitCode

  process.exitCode = 0

  try {
    await setupCli(routes).serve(args, {
      stdout: (s) => outputs.push(s),
      exit: (code) => {
        exitCalled = true
        exitCode = code
      },
    })

    if (!exitCalled && process.exitCode === 1) {
      exitCalled = true
      exitCode = process.exitCode
    }
  } finally {
    process.exitCode = originalProcessExitCode
  }

  return {
    output: outputs.join(''),
    exitCalled,
    exitCode,
  }
}

test('list files uses default limit and offset', async () => {
  const response = await runFileCommand(
    ['file', 'list', '--format', 'json'],
    [
      {
        method: 'GET',
        path: '/files',
        body: testGetFilesResponse,
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.files).toHaveLength(1)
  expect(payload.total).toBe(1)
})

test('info fetches file details by external id', async () => {
  const response = await runFileCommand(
    ['file', 'info', testExternalId, '--format', 'json'],
    [
      {
        method: 'GET',
        path: '/file/info',
        body: testUpload,
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.external_id).toBe(testExternalId)
})

test('info supports password option', async () => {
  const response = await runFileCommand(
    [
      'file',
      'info',
      testExternalId,
      '--password',
      'secret',
      '--format',
      'json',
    ],
    [
      {
        method: 'GET',
        path: '/file/info',
        body: testUpload,
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.external_id).toBe(testExternalId)
})

test('update with lock update_type calls file update endpoint', async () => {
  const response = await runFileCommand(
    [
      'file',
      'update',
      '--external-id',
      testExternalId,
      '--update-type',
      'lock',
      '--format',
      'json',
    ],
    [
      {
        method: 'PUT',
        path: '/file',
        body: {
          ...testUpload,
          external_id: testExternalId,
          file_name: 'locked.pdf',
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.external_id).toBe(testExternalId)
  expect(server.requests[0]).toMatchObject({
    method: 'PUT',
    path: '/file',
    body: { external_id: testExternalId },
  })
})

test('delete without confirmation fails with confirmation required', async () => {
  const response = await runFileCommand(
    ['file', 'delete', testExternalId, '--format', 'json'],
    [],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(true)
  expect(response.exitCode).toBe(1)
  expect(payload).toEqual({
    code: 'CONFIRMATION_REQUIRED',
    message: 'Pass --confirm to delete',
  })
})

test('delete with confirmation calls delete endpoint', async () => {
  const response = await runFileCommand(
    [
      'file',
      'delete',
      testExternalId,
      '--confirm',
      'true',
      '--format',
      'json',
    ],
    [
      {
        method: 'DELETE',
        path: '/file/my',
        body: { ok: true },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.ok).toBe(true)
  expect(server.requests[0]).toMatchObject({
    method: 'DELETE',
    path: '/file/my',
    body: null,
  })
})

test('move sends external id and target folder id', async () => {
  const response = await runFileCommand(
    [
      'file',
      'move',
      '--external-id',
      testExternalId,
      '--target-folder-id',
      '33',
      '--format',
      'json',
    ],
    [
      {
        method: 'POST',
        path: '/file/move',
        body: { ...testUpload },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.external_id).toBe(testExternalId)
  expect(server.requests[0]).toMatchObject({
    method: 'POST',
    path: '/file/move',
    body: {
      external_id: testExternalId,
      target_folder_id: 33,
    },
  })
})

test('email sends email parameter and external id body', async () => {
  const response = await runFileCommand(
    [
      'file',
      'email',
      '--external-id',
      testExternalId,
      '--email',
      'guest@example.com',
      '--format',
      'json',
    ],
    [
      {
        method: 'POST',
        path: '/file/email',
        body: { ok: true },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toEqual({ ok: true })
  expect(server.requests[0]).toMatchObject({
    method: 'POST',
    path: '/file/email',
    body: { external_id: testExternalId },
  })
})

test('delete --all without confirmation fails with CONFIRMATION_REQUIRED', async () => {
  const response = await runFileCommand(
    ['file', 'delete', '--all', 'true', '--format', 'json'],
    [],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(true)
  expect(response.exitCode).toBe(1)
  expect(payload).toEqual({
    code: 'CONFIRMATION_REQUIRED',
    message: 'Pass --confirm to delete',
  })
})

test('delete without externalId and without --all fails with MISSING_ARGUMENT', async () => {
  const response = await runFileCommand(
    ['file', 'delete', '--confirm', 'true', '--format', 'json'],
    [],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(true)
  expect(response.exitCode).toBe(1)
  expect(payload).toEqual({
    code: 'MISSING_ARGUMENT',
    message: 'Provide a file external ID or use --all to delete all files',
  })
})

test('delete with externalId and --all fails with CONFLICTING_OPTIONS', async () => {
  const response = await runFileCommand(
    [
      'file',
      'delete',
      testExternalId,
      '--all',
      'true',
      '--confirm',
      'true',
      '--format',
      'json',
    ],
    [],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(true)
  expect(response.exitCode).toBe(1)
  expect(payload).toEqual({
    code: 'CONFLICTING_OPTIONS',
    message: 'Cannot specify both file ID and --all',
  })
})

test('delete --all deletes all files across pages', async () => {
  const file1 = { ...testUpload, id: 10, external_id: 'ext_page1a', original_file_name: 'a.txt' }
  const file2 = { ...testUpload, id: 11, external_id: 'ext_page1b', original_file_name: 'b.txt' }
  const file3 = { ...testUpload, id: 12, external_id: 'ext_page2a', original_file_name: 'c.txt' }

  const response = await runFileCommand(
    ['file', 'delete', '--all', 'true', '--confirm', 'true', '--format', 'json'],
    [
      {
        method: 'GET',
        path: '/files',
        body: null,
        handler: (url) => {
          if (url.searchParams.get('offset') === '0' || url.searchParams.get('offset') === null) {
            return {
              body: {
                files: [file1, file2],
                has_more: true,
                total: 3,
              },
            }
          }

          return {
            body: {
              files: [file3],
              has_more: false,
              total: 3,
            },
          }
        },
      },
      {
        method: 'DELETE',
        path: '/file/my',
        body: { ok: true },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toEqual({
    deleted_count: 3,
    failed_count: 0,
    skipped_count: 0,
    total: 3,
  })
  expect(server.requests.filter((request) => request.method === 'GET')).toHaveLength(2)
  expect(server.requests.filter((request) => request.method === 'DELETE')).toHaveLength(3)
})

test('delete --all returns zero summary when no files exist', async () => {
  const response = await runFileCommand(
    ['file', 'delete', '--all', 'true', '--confirm', 'true', '--format', 'json'],
    [
      {
        method: 'GET',
        path: '/files',
        body: {
          files: [],
          has_more: false,
          total: 0,
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toEqual({
    deleted_count: 0,
    failed_count: 0,
    skipped_count: 0,
    total: 0,
  })
  expect(server.requests.filter((request) => request.method === 'DELETE')).toHaveLength(0)
})

test('delete --all skips files without external_id', async () => {
  const file1 = { ...testUpload, id: 20, external_id: 'ext_skip_ok1', original_file_name: 'keep-a.txt' }
  const file2 = { ...testUpload, id: 21, external_id: undefined, original_file_name: 'skip.txt' }
  const file3 = { ...testUpload, id: 22, external_id: 'ext_skip_ok2', original_file_name: 'keep-b.txt' }

  const response = await runFileCommand(
    ['file', 'delete', '--all', 'true', '--confirm', 'true', '--format', 'json'],
    [
      {
        method: 'GET',
        path: '/files',
        body: {
          files: [file1, file2, file3],
          has_more: false,
          total: 3,
        },
      },
      {
        method: 'DELETE',
        path: '/file/my',
        body: { ok: true },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toEqual({
    deleted_count: 2,
    failed_count: 0,
    skipped_count: 1,
    total: 3,
  })
  expect(server.requests.filter((request) => request.method === 'DELETE')).toHaveLength(2)
})

test('delete --all continues after delete failure and exits non-zero', async () => {
  const file1 = { ...testUpload, id: 30, external_id: 'ext_ok1', original_file_name: 'ok1.txt' }
  const file2 = { ...testUpload, id: 31, external_id: 'ext_fail', original_file_name: 'fail.txt' }
  const file3 = { ...testUpload, id: 32, external_id: 'ext_ok2', original_file_name: 'ok2.txt' }
  let deleteCallCount = 0

  const response = await runFileCommand(
    ['file', 'delete', '--all', 'true', '--confirm', 'true', '--format', 'json'],
    [
      {
        method: 'GET',
        path: '/files',
        body: {
          files: [file1, file2, file3],
          has_more: false,
          total: 3,
        },
      },
      {
        method: 'DELETE',
        path: '/file/my',
        body: null,
        handler: () => {
          deleteCallCount += 1

          if (deleteCallCount === 2) {
            return {
              status: 500,
              body: {
                error: {
                  code: 'INTERNAL',
                  message: 'fail',
                },
              },
            }
          }

          return {
            status: 200,
            body: { ok: true },
          }
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(true)
  expect(response.exitCode).toBe(1)
  expect(payload).toEqual({
    code: 'PARTIAL_DELETE_FAILURE',
    message: 'Some files could not be deleted',
    deleted_count: 2,
    failed_count: 1,
    skipped_count: 0,
    total: 3,
    failed_ids: ['ext_fail'],
  })
})

test('delete --all aborts if listing fails', async () => {
  const response = await runFileCommand(
    ['file', 'delete', '--all', 'true', '--confirm', 'true', '--format', 'json'],
    [
      {
        method: 'GET',
        path: '/files',
        status: 500,
        body: {
          error: {
            code: 'INTERNAL',
            message: 'Server error',
          },
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(true)
  expect(response.exitCode).toBe(1)
  expect(payload).toEqual({
    code: 'INTERNAL',
    message: 'Server error',
  })
  expect(server.requests.filter((request) => request.method === 'DELETE')).toHaveLength(0)
})

test('delete --all handles pagination guard (empty page with has_more)', async () => {
  const response = await runFileCommand(
    ['file', 'delete', '--all', 'true', '--confirm', 'true', '--format', 'json'],
    [
      {
        method: 'GET',
        path: '/files',
        body: null,
        handler: () => ({
          body: {
            files: [],
            has_more: true,
            total: 0,
          },
        }),
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toEqual({
    deleted_count: 0,
    failed_count: 0,
    skipped_count: 0,
    total: 0,
  })
}, 1000)
