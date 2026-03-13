import { Cli, z } from 'incur'
import { authVars } from '../../middleware/auth'
import type { GetFilesResponse, MoveFileRequest, Upload, OkResponse } from '../../types/api'

export const fileCli = Cli.create('file', {
  description: 'File management',
  vars: authVars,
})

fileCli.command('list', {
  description: 'List files',
  options: z.object({
    limit: z.number().default(20),
    offset: z.number().default(0),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    return client.get<GetFilesResponse>('/files', {
      limit: c.options.limit,
      offset: c.options.offset,
    })
  },
})

fileCli.command('info', {
  description: 'Get file information',
  args: z.object({
    externalId: z.string().describe('File external ID'),
  }),
  options: z.object({
    password: z.string().optional(),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    return client.get<Upload>('/file/info', {
      external_id: c.args.externalId,
      ...(c.options.password !== undefined ? { password: c.options.password } : {}),
    })
  },
})

fileCli.command('update', {
  description: 'Update file state',
  options: z.object({
    externalId: z.string(),
    updateType: z.enum(['lock', 'unlock']),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    return client.put<Upload>(`/file?update_type=${c.options.updateType}`, {
      external_id: c.options.externalId,
    })
  },
})

fileCli.command('delete', {
  description: 'Delete a file',
  args: z.object({
    externalId: z.string().describe('File external ID'),
  }),
  options: z.object({
    confirm: z.boolean().default(false),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    if (!c.options.confirm) {
      return c.error({
        code: 'CONFIRMATION_REQUIRED',
        message: 'Pass --confirm to delete',
      })
    }

    return client.delete<OkResponse>('/file/my', {
      external_id: c.args.externalId,
    })
  },
})

fileCli.command('move', {
  description: 'Move a file to another folder',
  options: z.object({
    externalId: z.string(),
    targetFolderId: z.number().optional(),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    const requestBody: MoveFileRequest = {
      external_id: c.options.externalId,
      ...(c.options.targetFolderId !== undefined
        ? { target_folder_id: c.options.targetFolderId }
        : {}),
    }

    return client.post<Upload>('/file/move', requestBody)
  },
})

fileCli.command('email', {
  description: 'Send file to an email',
  options: z.object({
    externalId: z.string(),
    email: z.string(),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    return client.post<OkResponse>(`/file/email?email=${c.options.email}`, {
      external_id: c.options.externalId,
    })
  },
})
