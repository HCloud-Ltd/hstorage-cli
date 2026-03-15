import { middleware, z } from 'incur'
import { createApiClient, getApiBaseUrl } from '../lib/client'
import { loadConfig } from '../lib/config'

type ApiClient = ReturnType<typeof createApiClient>

export const authVars = z.object({
  client: z.custom<ApiClient>().optional(),
})

export const requireAuth = middleware<typeof authVars>(async (c, next) => {
  if (c.var.client !== undefined) {
    return next()
  }

  if (c.command === 'folder get' || c.command === 'user delete' || c.command === 'file upload') {
    return next()
  }

  const config = await loadConfig()

  if (config === null) {
    return c.error({
      code: 'AUTH_REQUIRED',
      message: 'Not logged in. Run `hcli auth login` to authenticate.',
    })
  }

  const client = createApiClient(config, {
    baseUrl: getApiBaseUrl(),
  })

  c.set('client', client)

  return next()
})
