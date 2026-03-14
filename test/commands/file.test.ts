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
