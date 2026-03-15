import { Cli, z } from 'incur'
import { authVars } from '../../middleware/auth'
import type { UpdatePermissionRequest, OkResponse } from '../../types/api'

export const sftpCli = Cli.create('sftp', {
  description: 'SFTP/WebDAV management',
  vars: authVars,
})

sftpCli.command('permission', {
  description: 'Update SFTP/WebDAV permissions',
  options: z.object({
    insecure: z.boolean().describe('Enable insecure permissions (true) or reset to default (false)'),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    const body: UpdatePermissionRequest = {
      insecure: c.options.insecure,
    }

    return await client.post<OkResponse>('/sftp/permission', body)
  },
})
