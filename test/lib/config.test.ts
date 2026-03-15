import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  deleteConfig,
  getConfigDir,
  getConfigPath,
  hasConfig,
  loadConfig,
  saveConfig,
} from '../../src/lib/config'

let tmpDir: string
let originalXDG: string | undefined

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-test-'))
  originalXDG = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = tmpDir
})

afterEach(async () => {
  if (originalXDG !== undefined) {
    process.env.XDG_CONFIG_HOME = originalXDG
  } else {
    delete process.env.XDG_CONFIG_HOME
  }

  await rm(tmpDir, { recursive: true, force: true })
})

test('saveConfig creates file with correct content', async () => {
  const config = {
    email: 'test@example.com',
    apiKey: 'myapikey',
    secretKey: 'mysecret',
  }

  await saveConfig(config)

  const loaded = await loadConfig()

  expect(loaded).toEqual(config)
})

test('saveConfig sets file permissions to 0600', async () => {
  await saveConfig({
    email: 'test@example.com',
    apiKey: 'key',
    secretKey: 'secret',
  })

  const filePath = getConfigPath()
  const stats = await stat(filePath)
  const mode = stats.mode & 0o777

  expect(mode).toBe(0o600)
})

test('loadConfig returns null when file does not exist', async () => {
  const result = await loadConfig()

  expect(result).toBeNull()
})

test('deleteConfig removes credentials file', async () => {
  await saveConfig({
    email: 'test@example.com',
    apiKey: 'key',
    secretKey: 'secret',
  })

  expect(await hasConfig()).toBe(true)

  await deleteConfig()

  expect(await hasConfig()).toBe(false)
})

test('hasConfig returns false when no config exists', async () => {
  expect(await hasConfig()).toBe(false)
})

test('hasConfig returns true after saveConfig', async () => {
  await saveConfig({
    email: 'x@example.com',
    apiKey: 'k',
    secretKey: 's',
  })

  expect(await hasConfig()).toBe(true)
})

test('getConfigDir respects XDG_CONFIG_HOME', () => {
  const dir = getConfigDir()

  expect(dir).toContain('hstorage')
  expect(dir).toContain(tmpDir)
})
