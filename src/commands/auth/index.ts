import { Cli, z } from 'incur'
import { createApiClient, getApiBaseUrl } from '../../lib/client'
import { deleteConfig, hasConfig, loadConfig, saveConfig } from '../../lib/config'
import { promptInput, promptSecret } from '../../lib/prompt'

export const authCli = Cli.create('auth', {
  description: 'Authentication commands',
})

authCli.command('login', {
  description: 'Log in to HStorage',
  options: z.object({
    email: z.string().optional().describe('Email address'),
    apiKey: z.string().optional().describe('API key'),
    secretKey: z.string().optional().describe('Secret key'),
  }),
  run: async (c) => {
    const email = c.options.email ?? await promptInput('Email: ')
    const apiKey = c.options.apiKey ?? await promptSecret('API Key: ')
    const secretKey = c.options.secretKey ?? await promptSecret('Secret Key: ')

    if (!email || !apiKey || !secretKey) {
      return c.error({
        code: 'MISSING_CREDENTIALS',
        message: 'Email, API key, and secret key are required.',
      })
    }

    try {
      const client = createApiClient({ email, apiKey, secretKey }, { baseUrl: getApiBaseUrl() })
      await client.get('/user')
    } catch {
      return c.error({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      })
    }

    await saveConfig({ email, apiKey, secretKey })

    return {
      message: 'Logged in successfully',
      email,
    }
  },
})

authCli.command('logout', {
  description: 'Log out from HStorage',
  run: async (c) => {
    const config = await loadConfig()

    if (config === null) {
      return c.error({
        code: 'NOT_LOGGED_IN',
        message: 'Not logged in',
      })
    }

    const client = createApiClient(config, {
      baseUrl: getApiBaseUrl(),
    })

    try {
      await client.post('/user/logout')
    } catch {
    }

    await deleteConfig()

    return { message: 'Logged out successfully' }
  },
})

authCli.command('status', {
  description: 'Show auth status',
  run: async () => {
    if (!(await hasConfig())) {
      return {
        loggedIn: false,
      }
    }

    const config = await loadConfig()

    return {
      loggedIn: true,
      email: config?.email,
    }
  },
})
