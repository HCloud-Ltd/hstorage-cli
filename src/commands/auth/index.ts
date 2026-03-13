import { Cli, z } from 'incur'
import { createApiClient, getApiBaseUrl } from '../../lib/client'
import { deleteConfig, hasConfig, loadConfig, saveConfig } from '../../lib/config'

export const authCli = Cli.create('auth', {
  description: 'Authentication commands',
})

authCli.command('login', {
  description: 'Log in to hStorage',
  options: z.object({
    email: z.string().describe('Email address'),
    apiKey: z.string().describe('API key'),
    secretKey: z.string().describe('Secret key'),
  }),
  run: async (c) => {
    const res = await fetch(`${getApiBaseUrl()}/api/generate-crypto-key`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        api_key: c.options.apiKey,
        secret_key: c.options.secretKey,
      }),
    })

    if (!res.ok) {
      return c.error({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      })
    }

    await saveConfig({
      email: c.options.email,
      apiKey: c.options.apiKey,
      secretKey: c.options.secretKey,
    })

    return {
      message: 'Logged in successfully',
      email: c.options.email,
    }
  },
})

authCli.command('logout', {
  description: 'Log out from hStorage',
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

    await client.post('/user/logout')
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
