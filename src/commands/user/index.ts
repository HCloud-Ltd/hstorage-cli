import { Cli, z } from 'incur'
import type { LoginInit, UserSetting } from '../../types/api'
import { authVars } from '../../middleware/auth'
import { createApiClient, getApiBaseUrl } from '../../lib/client'
import { loadConfig } from '../../lib/config'

export const userCli = Cli.create('user', {
  description: 'User management',
  vars: authVars,
})

userCli.command('info', {
  description: 'Show user information',
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in. Run `hcli auth login` to authenticate.',
      })
    }

    const user = await client.get<LoginInit>('/user')

    return {
      subscription: user.subscription,
      usage: user.usage,
      storage_limit_bytes: user.storage_limit_bytes,
      storage_remaining_bytes: user.storage_remaining_bytes,
    }
  },
})

userCli.command('delete', {
  description: 'Delete current user account',
  options: z.object({
    confirm: z.boolean().default(false),
  }),
  run: async (c) => {
    if (!c.options.confirm) {
      return c.error({
        code: 'CONFIRMATION_REQUIRED',
        message: 'Pass --confirm to delete your account',
      })
    }

    let client = c.var.client

    if (!client) {
      const config = await loadConfig()

      if (!config) {
        return c.error({
          code: 'AUTH_REQUIRED',
          message: 'Not logged in. Run `hcli auth login` to authenticate.',
        })
      }

      client = createApiClient(config, {
        baseUrl: getApiBaseUrl(),
      })
    }

    return await client.delete('/user')
  },
})

userCli.command('settings-get', {
  description: 'Get user settings',
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in. Run `hcli auth login` to authenticate.',
      })
    }

    return await client.get<UserSetting>('/user/setting')
  },
})

userCli.command('settings-update', {
  description: 'Update user settings',
  options: z.object({
    enableAutoDelete: z.boolean().optional(),
    automaticDeletionSeconds: z.number().optional(),
    enableAutoPassword: z.boolean().optional(),
    password: z.string().optional(),
    enableAutoEncryption: z.boolean().optional(),
    enableDownloadNotification: z.boolean().optional(),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in. Run `hcli auth login` to authenticate.',
      })
    }

    const requestBody: Record<string, string | number | boolean> = {}

    if (c.options.enableAutoDelete !== undefined) {
      requestBody.enable_auto_delete = c.options.enableAutoDelete
    }

    if (c.options.automaticDeletionSeconds !== undefined) {
      requestBody.automatic_deletion_seconds = c.options.automaticDeletionSeconds
    }

    if (c.options.enableAutoPassword !== undefined) {
      requestBody.enable_auto_password = c.options.enableAutoPassword
    }

    if (c.options.password !== undefined) {
      requestBody.password = c.options.password
    }

    if (c.options.enableAutoEncryption !== undefined) {
      requestBody.enable_auto_encryption = c.options.enableAutoEncryption
    }

    if (c.options.enableDownloadNotification !== undefined) {
      requestBody.enable_download_notification = c.options.enableDownloadNotification
    }

    return await client.put<UserSetting>('/user/setting', requestBody)
  },
})
