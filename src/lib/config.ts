import { chmod, mkdir, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { HStorageConfig } from '../types/config'

export function getConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME
  const base = xdgConfigHome ?? join(homedir(), '.config')

  return join(base, 'hstorage')
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'credentials.json')
}

export async function saveConfig(config: HStorageConfig): Promise<void> {
  const dir = getConfigDir()
  const path = getConfigPath()

  await mkdir(dir, { recursive: true })
  await Bun.write(path, JSON.stringify(config, null, 2))
  await chmod(path, 0o600)
}

export async function loadConfig(): Promise<HStorageConfig | null> {
  const path = getConfigPath()

  try {
    const file = Bun.file(path)
    const exists = await file.exists()

    if (!exists) {
      return null
    }

    return (await file.json()) as HStorageConfig
  } catch {
    return null
  }
}

export async function deleteConfig(): Promise<void> {
  const path = getConfigPath()

  try {
    await unlink(path)
  } catch {
  }
}

export async function hasConfig(): Promise<boolean> {
  const config = await loadConfig()

  return config !== null
}
