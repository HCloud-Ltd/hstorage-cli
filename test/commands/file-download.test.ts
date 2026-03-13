import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Cli, middleware } from 'incur'
import { createMockServer, type Route } from '../helpers/mock-server'
import { testConfig, testNonceResponse, testUpload } from '../helpers/fixtures'
import type { Upload } from '../../src/types/api'
import { authVars } from '../../src/middleware/auth'
import { createApiClient } from '../../src/lib/client'
import { downloadCli } from '../../src/commands/file/download'

interface RecordedRequest {
  method: string
  path: string
  headers: Record<string, string>
  body: unknown
}

interface TestServer {
  url: string
  requests: RecordedRequest[]
  stop: () => void
}

let server: TestServer = createMockServer([])
let tmpDir = ''

afterEach(async () => {
  server.stop()

  if (tmpDir !== '') {
    await rm(tmpDir, { recursive: true, force: true })
  }

  tmpDir = ''
})

function createDownloadMockServer(
  fileContent: string,
  options: {
    fileInfo?: Upload
    password?: string
  } = {},
): TestServer {
  const requests: RecordedRequest[] = []
  let mockServer: ReturnType<typeof Bun.serve> | null = null
  let mockServerUrl = ''
  const fileInfo = options.fileInfo ?? testUpload
  const expectedPassword = options.password

  const fetchHandler = async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    let body: unknown = null

    try {
      const text = await req.text()
      if (text !== '') {
        const contentType = req.headers.get('content-type') ?? ''
        if (contentType.includes('application/json')) {
          try {
            body = JSON.parse(text)
          } catch {
            body = text
          }
        } else {
          body = text
        }
      }
    } catch {
      body = null
    }

    requests.push({
      method: req.method,
      path: `${url.pathname}${url.search}`,
      headers: Object.fromEntries(req.headers.entries()),
      body,
    })

    if (url.pathname === '/api/generate-crypto-key' && req.method === 'POST') {
      return new Response(JSON.stringify(testNonceResponse), {
        headers: {
          'content-type': 'application/json',
        },
      })
    }

    if (url.pathname === '/file/info' && req.method === 'GET') {
      if (expectedPassword !== undefined && url.searchParams.get('password') !== expectedPassword) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'FILE_NOT_FOUND',
              message: 'File not found',
            },
          }),
          {
            status: 404,
            headers: {
              'content-type': 'application/json',
            },
          },
        )
      }

      return new Response(
        JSON.stringify({
          ...fileInfo,
          download_url: `${mockServerUrl}/file-content`,
        }),
        {
          headers: {
            'content-type': 'application/json',
          },
        },
      )
    }

    if (url.pathname === '/file-content' && req.method === 'GET') {
      return new Response(JSON.stringify(fileContent), {
        headers: {
          'content-type': 'application/json',
        },
      })
    }

    return new Response('Not Found', { status: 404 })
  }

  mockServer = Bun.serve({
    port: 0,
    fetch: fetchHandler,
  })

  mockServerUrl = mockServer.url.toString().replace(/\/$/, '')

  return {
    url: mockServerUrl,
    requests,
    stop: () => {
      if (mockServer !== null) {
        mockServer.stop()
      }
    },
  }
}

function createPasswordAwareServer(password: string, fileContent: string): TestServer {
  return createDownloadMockServer(fileContent, {
    fileInfo: testUpload,
    password,
  })
}

function setupDownloadCli(): ReturnType<typeof Cli.create> {
  const mockClient = createApiClient(testConfig, { baseUrl: server.url })

  return Cli.create('test', { vars: authVars })
    .use(
      middleware<typeof authVars>(async (c, next) => {
        c.set('client', mockClient)
        return next()
      }),
    )
    .command(downloadCli)
}

async function runDownloadCommand(args: string[]) {
  const outputs: string[] = []
  let exitCalled = false
  let exitCode = 0

  await setupDownloadCli().serve(args, {
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

test('downloads file and saves to the default output path', async () => {
  const fileContent = 'hello world content'
  const expectedContent = JSON.stringify(fileContent)
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-download-default-'))
  const originalCwd = process.cwd()
  process.chdir(tmpDir)

  try {
    server = createDownloadMockServer(fileContent, {
      fileInfo: testUpload,
    })

    const response = await runDownloadCommand([
      'download',
      testUpload.external_id!,
      '--format',
      'json',
    ])

    const result = JSON.parse(response.output)
    const expectedPath = join(process.cwd(), testUpload.original_file_name ?? testUpload.file_name ?? testUpload.external_id!)

    expect(response.exitCalled).toBe(false)
    expect(result.saved_to).toBe(expectedPath)
    expect(result.file_name).toBe(testUpload.file_name)
    expect(result.original_file_name).toBe(testUpload.original_file_name)
    expect(await Bun.file(expectedPath).text()).toBe(expectedContent)
    expect(server.requests).toHaveLength(3)
    expect(server.requests[1]).toMatchObject({
      method: 'GET',
    })
    expect(server.requests[1]?.path.startsWith('/file/info')).toBe(true)
    expect(server.requests[2]).toMatchObject({
      method: 'GET',
      path: '/file-content',
    })
  } finally {
    process.chdir(originalCwd)
  }
})

test('downloads to the path specified by --output', async () => {
  const fileContent = 'custom output test content'
  const expectedContent = JSON.stringify(fileContent)
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-download-output-'))

  server = createDownloadMockServer(fileContent, {
    fileInfo: testUpload,
  })
  const outputPath = join(tmpDir, 'custom-download.txt')

  const response = await runDownloadCommand([
    'download',
    testUpload.external_id!,
    '--output',
    outputPath,
    '--format',
    'json',
  ])

  const result = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(result.saved_to).toBe(outputPath)
  expect(result.file_size).toBe(testUpload.file_size)
  expect(await Bun.file(outputPath).text()).toBe(expectedContent)
  expect(server.requests).toHaveLength(3)
  expect(server.requests[1]).toMatchObject({
    method: 'GET',
  })
  expect(server.requests[1]?.path.startsWith('/file/info')).toBe(true)
})

test('sends password as query parameter for file info request', async () => {
  const fileContent = 'password protected content'
  const expectedContent = JSON.stringify(fileContent)
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-download-password-'))
  const outputPath = join(tmpDir, 'password-download.txt')

  server = createPasswordAwareServer('secret', fileContent)

  const response = await runDownloadCommand([
    'download',
    testUpload.external_id!,
    '--password',
    'secret',
    '--output',
    outputPath,
    '--format',
    'json',
  ])

  const result = JSON.parse(response.output)
  const infoRequest = server.requests.find((request) => request.path.startsWith('/file/info'))
  expect(infoRequest).toBeDefined()
  if (!infoRequest) {
    throw new Error('Expected file info request was not recorded')
  }

  const infoRequestUrl = new URL(`${server.url}${infoRequest.path}`)

  expect(response.exitCalled).toBe(false)
  expect(infoRequestUrl.searchParams.get('password')).toBe('secret')
  expect(infoRequestUrl.searchParams.get('external_id')).toBe(testUpload.external_id!)
  expect(result.saved_to).toBe(outputPath)
  expect(await Bun.file(outputPath).text()).toBe(expectedContent)
  expect(server.requests).toHaveLength(3)
  expect(infoRequest).toMatchObject({
    method: 'GET',
    path: `/file/info?external_id=${testUpload.external_id}&password=secret`,
  })
})

test('returns FILE_NOT_FOUND when /file/info responds with 404', async () => {
  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
    {
      method: 'GET',
      path: '/file/info',
      status: 404,
      body: {
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found',
        },
      },
    },
  ])

  const response = await runDownloadCommand([
    'download',
    testUpload.external_id!,
    '--format',
    'json',
  ])

  const result = JSON.parse(response.output)

  expect(response.exitCalled).toBe(true)
  expect(response.exitCode).toBe(1)
  expect(result).toEqual({
    code: 'FILE_NOT_FOUND',
    message: 'File not found',
  })
  expect(server.requests).toHaveLength(2)
  expect(server.requests[1]).toMatchObject({
    method: 'GET',
    path: '/file/info',
  })
})
