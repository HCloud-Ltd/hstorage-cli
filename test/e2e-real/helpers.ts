import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cli } from '../../src/index'
import { saveConfig } from '../../src/lib/config'
import { createApiClient } from '../../src/lib/client'
import type { HStorageConfig } from '../../src/types/config'
import type { Folder, OkResponse } from '../../src/types/api'

export interface E2ERealEnv {
  email: string
  apiKey: string
  secretKey: string
  apiUrl: string
}

export function loadE2EEnv(): E2ERealEnv {
  const email = process.env.HSTORAGE_EMAIL
  const apiKey = process.env.HSTORAGE_API_KEY
  const secretKey = process.env.HSTORAGE_SECRET_KEY
  const apiUrl = process.env.HSTORAGE_API_URL || 'https://stg-api.hstorage.io'

  if (!email || !apiKey || !secretKey) {
    throw new Error(
      'Missing required environment variables: HSTORAGE_EMAIL, HSTORAGE_API_KEY, HSTORAGE_SECRET_KEY',
    )
  }

  return { email, apiKey, secretKey, apiUrl }
}

export function makeConfig(env: E2ERealEnv): HStorageConfig {
  return {
    email: env.email,
    apiKey: env.apiKey,
    secretKey: env.secretKey,
  }
}

export function isDestructiveEnabled(): boolean {
  return process.env.HSTORAGE_E2E_DESTRUCTIVE === 'true'
}

export async function runCli(argv: string[]) {
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

export function parseJsonOutput<T = unknown>(output: string): T {
  return JSON.parse(output) as T
}

export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export interface E2EContext {
  tmpDir: string
  env: E2ERealEnv
  originalXDG: string | undefined
  originalApiUrl: string | undefined
}

export async function setupE2EContext(): Promise<E2EContext> {
  const env = loadE2EEnv()
  const tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-e2e-real-'))
  const originalXDG = process.env.XDG_CONFIG_HOME
  const originalApiUrl = process.env.HSTORAGE_API_URL

  process.env.XDG_CONFIG_HOME = tmpDir
  process.env.HSTORAGE_API_URL = env.apiUrl

  await saveConfig(makeConfig(env))

  return { tmpDir, env, originalXDG, originalApiUrl }
}

export async function teardownE2EContext(ctx: E2EContext | undefined): Promise<void> {
  if (!ctx) return

  if (ctx.originalXDG === undefined) {
    delete process.env.XDG_CONFIG_HOME
  } else {
    process.env.XDG_CONFIG_HOME = ctx.originalXDG
  }

  if (ctx.originalApiUrl === undefined) {
    delete process.env.HSTORAGE_API_URL
  } else {
    process.env.HSTORAGE_API_URL = ctx.originalApiUrl
  }

  await rm(ctx.tmpDir, { recursive: true, force: true })
}

export function createDirectClient(env: E2ERealEnv) {
  return createApiClient(makeConfig(env), { baseUrl: env.apiUrl })
}

export async function cleanupFolder(env: E2ERealEnv, folderId: number): Promise<void> {
  try {
    const client = createDirectClient(env)
    await client.delete<OkResponse>('/folder', { id: folderId, mode: 'cascade' })
  } catch {
  }
}

export async function cleanupFile(env: E2ERealEnv, externalId: string): Promise<void> {
  try {
    const client = createDirectClient(env)
    await client.delete<OkResponse>('/file/my', { external_id: externalId })
  } catch {
  }
}
