import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Cli } from 'incur'
import { authVars, requireAuth } from '../../src/middleware/auth'
import { saveConfig } from '../../src/lib/config'
import { testConfig } from '../helpers/fixtures'

let tmpDir: string
let originalXDG: string | undefined

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-test-'))
  originalXDG = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = tmpDir
})

afterEach(async () => {
  if (originalXDG === undefined) {
    delete process.env.XDG_CONFIG_HOME
  } else {
    process.env.XDG_CONFIG_HOME = originalXDG
  }

  await rm(tmpDir, { recursive: true, force: true })
})

test('returns AUTH_REQUIRED when credentials are missing', async () => {
  const outputs: string[] = []
  let exitCalled = false
  let exitCode = 0

  const cli = Cli.create('hstorage', {
    description: 'hStorage CLI - File management from the command line',
    vars: authVars,
  })
    .use(requireAuth)
    .command('status', {
      description: 'Show auth status',
      run: () => ({ ok: true }),
    })

  await cli.serve(['status', '--format', 'json'], {
    exit: (code) => {
      exitCalled = true
      exitCode = code
    },
    stdout: (output) => {
      outputs.push(output)
    },
  })

  const payload = JSON.parse(outputs.join(''))

  expect(exitCalled).toBe(true)
  expect(exitCode).toBe(1)
  expect(payload).toEqual({
    code: 'AUTH_REQUIRED',
    message: 'Not logged in. Run `hstorage auth login` to authenticate.',
  })
})

test('injects API client when credentials exist', async () => {
  const outputs: string[] = []
  let exitCalled = false

  await saveConfig(testConfig)

  const cli = Cli.create('hstorage', {
    description: 'hStorage CLI - File management from the command line',
    vars: authVars,
  })
    .use(requireAuth)
    .command('status', {
      description: 'Show auth status',
      run: (c) => ({ hasClient: c.var.client !== undefined }),
    })

  await cli.serve(['status', '--format', 'json'], {
    exit: (code) => {
      exitCalled = true
    },
    stdout: (output) => {
      outputs.push(output)
    },
  })

  const payload = JSON.parse(outputs.join(''))

  expect(exitCalled).toBe(false)
  expect(payload).toEqual({
    hasClient: true,
  })
})
