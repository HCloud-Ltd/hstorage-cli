import { afterEach, beforeEach, describe, it, expect } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { statSync } from 'node:fs'
import { cli } from '../../src/index'
import { createMockServer, type Route } from '../helpers/mock-server'
import { saveConfig, getConfigPath } from '../../src/lib/config'
import { testConfig, testNonceResponse } from '../helpers/fixtures'

let server: ReturnType<typeof createMockServer> | null = null
let tmpDir = ''
let previousXDG: string | undefined
let previousApiUrl: string | undefined

const presignedUrlWithSecretPreview = `https://presigned.example.com/preview`

function buildUploadResponse(baseUrl: string) {
  return {
    external_id: 'ext_secret_check',
    file_name: 'secret-check.txt',
    pre_signed_url: `${baseUrl}/upload-target?origin=${encodeURIComponent(presignedUrlWithSecretPreview)}`,
    share_url: 'https://hstorage.example.com/f/secret-check',
    direct_url: 'https://cdn.hstorage.example.com/secret-check.txt',
  }
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-security-'))
  previousXDG = process.env.XDG_CONFIG_HOME
  previousApiUrl = process.env.HSTORAGE_API_URL
  process.env.XDG_CONFIG_HOME = tmpDir
})

afterEach(async () => {
  if (server !== null) {
    server.stop()
    server = null
  }

  if (previousXDG === undefined) {
    delete process.env.XDG_CONFIG_HOME
  } else {
    process.env.XDG_CONFIG_HOME = previousXDG
  }

  if (previousApiUrl === undefined) {
    delete process.env.HSTORAGE_API_URL
  } else {
    process.env.HSTORAGE_API_URL = previousApiUrl
  }

  await rm(tmpDir, { recursive: true, force: true })
})

function withMockServer(routes: Route[]) {
  const presignedRoute = {
    method: 'POST' as const,
    path: '/upload/v1/presigned',
    body: buildUploadResponse(''),
  }

  const putRoute = {
    method: 'PUT' as const,
    path: '/upload-target',
    body: {},
  }

  server = createMockServer([
    ...routes,
    presignedRoute,
    putRoute,
  ])

  presignedRoute.body = buildUploadResponse(server.url)

  return server
}

async function runCli(argv: string[]) {
  const output: string[] = []
  let exitCalled = false
  let exitCode = 0

  await cli.serve(argv, {
    stdout: (chunk) => {
      output.push(chunk)
    },
    exit: (code) => {
      exitCalled = true
      exitCode = code
    },
  })

  return {
    output: output.join(''),
    exitCalled,
    exitCode,
  }
}

describe('secret redaction', () => {
  it('does not print secret_key in auth login output', async () => {
    server = createMockServer([
      {
        method: 'POST',
        path: '/api/generate-crypto-key',
        body: testNonceResponse,
      },
    ])
    process.env.HSTORAGE_API_URL = server.url

    const response = await runCli([
      'auth',
      'login',
      '--email',
      testConfig.email,
      '--api-key',
      testConfig.apiKey,
      '--secret-key',
      testConfig.secretKey,
      '--format',
      'json',
    ])

    expect(response.exitCalled).toBe(false)
    expect(JSON.parse(response.output)).toEqual({
      message: 'Logged in successfully',
      email: testConfig.email,
    })
    expect(response.output).not.toContain('secret_key')
    expect(response.output).not.toContain(testConfig.secretKey)
  })

  it('does not print apiKey in auth login output', async () => {
    server = createMockServer([
      {
        method: 'POST',
        path: '/api/generate-crypto-key',
        body: testNonceResponse,
      },
    ])
    process.env.HSTORAGE_API_URL = server.url

    const response = await runCli([
      'auth',
      'login',
      '--email',
      testConfig.email,
      '--api-key',
      testConfig.apiKey,
      '--secret-key',
      testConfig.secretKey,
      '--format',
      'json',
    ])

    expect(response.exitCalled).toBe(false)
    expect(response.output).not.toContain('apiKey')
    expect(response.output).not.toContain(testConfig.apiKey)
  })

  it('does not print presigned_url / pre_signed_url in upload output', async () => {
    await saveConfig(testConfig)
    server = withMockServer([
      {
        method: 'POST',
        path: '/api/generate-crypto-key',
        body: testNonceResponse,
      },
    ])
    process.env.HSTORAGE_API_URL = server.url

    const uploadFile = join(tmpDir, 'secret-check.txt')
    await Bun.write(uploadFile, 'hello secret redaction')

    const response = await runCli([
      'file',
      'upload',
      uploadFile,
      '--format',
      'json',
    ])

    expect(response.exitCalled).toBe(false)
    expect(response.output).not.toContain('pre_signed_url')
    expect(response.output).not.toContain('presigned_url')
    expect(response.output).not.toContain(presignedUrlWithSecretPreview)
  })

  it('does not print x-eu-api-key header value in upload output', async () => {
    await saveConfig(testConfig)
    server = withMockServer([
      {
        method: 'POST',
        path: '/api/generate-crypto-key',
        body: testNonceResponse,
      },
    ])
    process.env.HSTORAGE_API_URL = server.url

    const uploadFile = join(tmpDir, 'secret-header.txt')
    await Bun.write(uploadFile, 'header redaction')

    const response = await runCli([
      'file',
      'upload',
      uploadFile,
      '--format',
      'json',
    ])

    expect(response.exitCalled).toBe(false)
    expect(response.output).not.toContain('x-eu-api-key')
    expect(response.output).not.toContain(testConfig.apiKey)
  })

  it('does not print x-eu-nonce header value in upload output', async () => {
    await saveConfig(testConfig)
    server = withMockServer([
      {
        method: 'POST',
        path: '/api/generate-crypto-key',
        body: testNonceResponse,
      },
    ])
    process.env.HSTORAGE_API_URL = server.url

    const uploadFile = join(tmpDir, 'secret-nonce.txt')
    await Bun.write(uploadFile, 'nonce redaction')

    const response = await runCli([
      'file',
      'upload',
      uploadFile,
      '--format',
      'json',
    ])

    expect(response.exitCalled).toBe(false)
    expect(response.output).not.toContain('x-eu-nonce')
    expect(response.output).not.toContain(testNonceResponse.nonce)
  })

  it('creates credentials file with 0600 permissions', async () => {
    server = createMockServer([
      {
        method: 'POST',
        path: '/api/generate-crypto-key',
        body: testNonceResponse,
      },
    ])
    process.env.HSTORAGE_API_URL = server.url

    const response = await runCli([
      'auth',
      'login',
      '--email',
      testConfig.email,
      '--api-key',
      testConfig.apiKey,
      '--secret-key',
      testConfig.secretKey,
      '--format',
      'json',
    ])

    expect(response.exitCalled).toBe(false)

    const credsPath = getConfigPath()
    const mode = statSync(credsPath).mode & 0o777

    expect(mode).toBe(0o600)
  })
})
