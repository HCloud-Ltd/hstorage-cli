import { afterEach, expect, test } from 'bun:test'
import { Cli, middleware } from 'incur'
import { createMockServer, type Route } from '../helpers/mock-server'
import {
  testConfig,
  testNonceResponse,
  testFolder,
  testFolderResponse,
  testFolderTreeResponse,
} from '../helpers/fixtures'
import { authVars } from '../../src/middleware/auth'
import { createApiClient } from '../../src/lib/client'
import { folderCli } from '../../src/commands/folder'

let server: ReturnType<typeof createMockServer> | null = null

function getServer(): NonNullable<typeof server> {
  if (server === null) {
    throw new Error('Mock server is not initialized')
  }

  return server
}

afterEach(() => {
  if (server !== null) {
    server.stop()
    server = null
  }
})

function setupCli(routes: Route[]) {
  server = createMockServer([
    { method: 'POST', path: '/api/generate-crypto-key', body: testNonceResponse },
    ...routes,
  ])

  const client = createApiClient(testConfig, { baseUrl: server.url })

  return Cli.create('test', { vars: authVars })
    .use(
      middleware<typeof authVars>(async (c, next) => {
        c.set('client', client)
        return next()
      }),
    )
    .command(folderCli)
}

function setupPublicFolderServer(response: unknown, options: { password?: string } = {}) {
  const requests: string[] = []
  let serverUrl = ''

  const mockServer = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url)
      requests.push(`${req.method} ${url.pathname}${url.search}`)

      if (url.pathname === '/folder') {
        if (options.password !== undefined && url.searchParams.get('password') !== options.password) {
          return new Response('Not Found', { status: 404 })
        }

        return new Response(JSON.stringify(response), {
          headers: {
            'content-type': 'application/json',
          },
        })
      }

      if (url.pathname === '/api/generate-crypto-key') {
        return new Response(JSON.stringify(testNonceResponse), {
          headers: {
            'content-type': 'application/json',
          },
        })
      }

      return new Response('Not Found', { status: 404 })
    },
  })

  serverUrl = mockServer.url.toString().replace(/\/$/, '')

  return {
    url: serverUrl,
    requests,
    stop: () => {
      mockServer.stop()
    },
  }
}

function toRequestUrl(baseUrl: string, requests: string[]): URL {
  const request = requests[0]

  if (typeof request !== 'string') {
    throw new Error('Expected a request to be recorded')
  }

  const parts = request.split(' ')
  const method = parts[0]

  if (method !== 'GET' || parts.length < 2) {
    throw new Error('Expected GET request')
  }

  return new URL(`${baseUrl}${parts[1]}`)
}

async function runFolderCommand(args: string[], routes: Route[]) {
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

async function runFolderCommandWithoutAuth(args: string[]) {
  const outputs: string[] = []
  let exitCalled = false
  let exitCode = 0

  await Cli.create('test', { vars: authVars }).command(folderCli).serve(args, {
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

test('list returns folder tree response', async () => {
  const response = await runFolderCommand(
    ['folder', 'list', '--format', 'json'],
    [{ method: 'GET', path: '/folders', body: testFolderTreeResponse }],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.folders).toHaveLength(1)
  expect(payload.folders[0]).toMatchObject({
    uid: testFolderTreeResponse.folders?.[0]?.uid,
    name: testFolderTreeResponse.folders?.[0]?.name,
  })
  expect(getServer().requests[1]).toMatchObject({
    method: 'GET',
    path: '/folders',
  })
})

test('get fetches folder with auth client', async () => {
  const response = await runFolderCommand(
    ['folder', 'get', testFolder.uid!, '--format', 'json'],
    [
      {
        method: 'GET',
        path: '/folder',
        body: testFolderResponse,
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.folder).toMatchObject({
    uid: testFolderResponse.folder?.uid,
    name: testFolderResponse.folder?.name,
  })
  expect(getServer().requests[1]).toMatchObject({
    method: 'GET',
    path: '/folder',
  })
})

test('get with auth includes uid and optional password in request params', async () => {
  const response = await runFolderCommand(
    [
      'folder',
      'get',
      testFolder.uid!,
      '--password',
      'secret',
      '--format',
      'json',
    ],
    [{
      method: 'GET',
      path: '/folder',
      body: testFolderResponse,
    }],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.folder?.uid).toBe(testFolder.uid!)
  expect(getServer().requests[1]).toMatchObject({
    method: 'GET',
    path: '/folder',
  })
})

test('get without auth fetches public folder using raw fetch', async () => {
  const publicServer = setupPublicFolderServer(testFolderResponse)
  const originalApiUrl = process.env.HSTORAGE_API_URL
  process.env.HSTORAGE_API_URL = publicServer.url

  try {
    const response = await runFolderCommandWithoutAuth([
      'folder',
      'get',
      testFolder.uid!,
      '--format',
      'json',
    ])

    const payload = JSON.parse(response.output)

    expect(response.exitCalled).toBe(false)
    expect(payload.folder).toMatchObject({
      uid: testFolder.uid!,
    })

    const requestUrl = toRequestUrl(publicServer.url, publicServer.requests)
    expect(requestUrl.pathname).toBe('/folder')
    expect(requestUrl.searchParams.get('uid')).toBe(testFolder.uid!)
  } finally {
    if (originalApiUrl === undefined) {
      delete process.env.HSTORAGE_API_URL
    } else {
      process.env.HSTORAGE_API_URL = originalApiUrl
    }

    publicServer.stop()
  }
})

test('get without auth uses password query param', async () => {
  const publicServer = setupPublicFolderServer(testFolderResponse, { password: 'secret' })
  const originalApiUrl = process.env.HSTORAGE_API_URL
  process.env.HSTORAGE_API_URL = publicServer.url

  try {
    const response = await runFolderCommandWithoutAuth([
      'folder',
      'get',
      testFolder.uid!,
      '--password',
      'secret',
      '--format',
      'json',
    ])

    const payload = JSON.parse(response.output)
    expect(response.exitCalled).toBe(false)
    expect(payload.folder).toMatchObject({
      uid: testFolder.uid,
    })

    const requestUrl = toRequestUrl(publicServer.url, publicServer.requests)
    expect(requestUrl.searchParams.get('password')).toBe('secret')
  } finally {
    if (originalApiUrl === undefined) {
      delete process.env.HSTORAGE_API_URL
    } else {
      process.env.HSTORAGE_API_URL = originalApiUrl
    }

    publicServer.stop()
  }
})

test('get without auth returns folder not found when response is not ok', async () => {
  const publicServer = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url)

      if (url.pathname === '/folder') {
        return new Response(
          JSON.stringify({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } }),
          {
            status: 404,
            headers: {
              'content-type': 'application/json',
            },
          },
        )
      }

      if (url.pathname === '/api/generate-crypto-key') {
        return new Response(JSON.stringify(testNonceResponse), {
          headers: {
            'content-type': 'application/json',
          },
        })
      }

      return new Response('Not Found', { status: 404 })
    },
  })

  const originalApiUrl = process.env.HSTORAGE_API_URL
  process.env.HSTORAGE_API_URL = publicServer.url.toString().replace(/\/$/, '')

  try {
    const response = await runFolderCommandWithoutAuth([
      'folder',
      'get',
      testFolder.uid!,
      '--format',
      'json',
    ])

    const payload = JSON.parse(response.output)

    expect(response.exitCalled).toBe(true)
    expect(response.exitCode).toBe(1)
    expect(payload).toEqual({
      code: 'FOLDER_NOT_FOUND',
      message: 'Folder not found',
    })
  } finally {
    if (originalApiUrl === undefined) {
      delete process.env.HSTORAGE_API_URL
    } else {
      process.env.HSTORAGE_API_URL = originalApiUrl
    }

    publicServer.stop()
  }
})

test('create posts folder data and returns created folder', async () => {
  const response = await runFolderCommand(
    [
      'folder',
      'create',
      '--name',
      'New Folder',
      '--parent-id',
      '10',
      '--public-view',
      'true',
      '--public-upload',
      'true',
      '--format',
      'json',
    ],
    [
      {
        method: 'PUT',
        path: '/folder',
        body: {
          ...testFolder,
          id: 2,
          name: 'New Folder',
          parent_id: 10,
          is_public_view: true,
          is_public_upload: true,
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toMatchObject({
    name: 'New Folder',
    parent_id: 10,
    is_public_view: true,
    is_public_upload: true,
  })
  expect(getServer().requests[1]).toMatchObject({
    method: 'PUT',
    path: '/folder',
    body: {
      name: 'New Folder',
      parent_id: 10,
      is_public_view: true,
      is_public_upload: true,
    },
  })
})

test('update sends partial fields and returns updated folder', async () => {
  const response = await runFolderCommand(
    [
      'folder',
      'update',
      '--id',
      '1',
      '--name',
      'Updated Folder',
      '--parent-id',
      '5',
      '--format',
      'json',
    ],
    [
      {
        method: 'POST',
        path: '/folder',
        body: {
          ...testFolder,
          name: 'Updated Folder',
          parent_id: 5,
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.name).toBe('Updated Folder')
  expect(payload.parent_id).toBe(5)
  expect(getServer().requests[1]).toMatchObject({
    method: 'POST',
    path: '/folder',
    body: {
      id: 1,
      name: 'Updated Folder',
      parent_id: 5,
    },
  })
})

test('delete without confirm returns confirmation error', async () => {
  const response = await runFolderCommand(
    ['folder', 'delete', '--id', '1', '--format', 'json'],
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

test('delete with confirm calls API and returns ok', async () => {
  const response = await runFolderCommand(
    [
      'folder',
      'delete',
      '--id',
      '1',
      '--confirm',
      'true',
      '--format',
      'json',
    ],
    [
      {
        method: 'DELETE',
        path: '/folder',
        body: { ok: true },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toEqual({ ok: true })
  expect(getServer().requests[1]).toMatchObject({
    method: 'DELETE',
    path: '/folder',
  })
  expect(getServer().requests[1].body).toBeNull()
})
