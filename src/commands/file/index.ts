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
    externalId: z.string().optional().describe('File external ID'),
  }),
  options: z.object({
    all: z.boolean().default(false),
    confirm: z.boolean().default(false),
  }),
  run: async (c) => {
    const client = c.var.client
    const externalId = c.args.externalId === 'true'
      || c.args.externalId === 'false'
      || c.args.externalId?.startsWith('--')
      ? undefined
      : c.args.externalId

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

    if (externalId && c.options.all) {
      return c.error({
        code: 'CONFLICTING_OPTIONS',
        message: 'Cannot specify both file ID and --all',
      })
    }

    if (!externalId && !c.options.all) {
      return c.error({
        code: 'MISSING_ARGUMENT',
        message: 'Provide a file external ID or use --all to delete all files',
      })
    }

    if (externalId && !c.options.all) {
      return client.delete<OkResponse>('/file/my', {
        external_id: externalId,
      })
    }

    const allFiles: Upload[] = []
    let offset = 0
    const limit = 100

    while (true) {
      let page: GetFilesResponse

      try {
        page = await client.get<GetFilesResponse>('/files', { limit, offset })
      } catch (error) {
        const apiError = typeof error === 'object' && error !== null && 'error' in error
          ? error.error
          : undefined
        const code = typeof apiError === 'object' && apiError !== null && 'code' in apiError && typeof apiError.code === 'string'
          ? apiError.code
          : 'UNKNOWN'
        const message = typeof apiError === 'object' && apiError !== null && 'message' in apiError && typeof apiError.message === 'string'
          ? apiError.message
          : error instanceof Error
            ? error.message
            : String(error)

        return c.error({ code, message })
      }

      allFiles.push(...page.files)

      if (!page.has_more || page.files.length === 0) {
        break
      }

      offset += limit
    }

    let deletedCount = 0
    let failedCount = 0
    let skippedCount = 0
    const failedIds: string[] = []

    for (const file of allFiles) {
      if (!file.external_id) {
        skippedCount++
        continue
      }

      try {
        await client.delete<OkResponse>('/file/my', { external_id: file.external_id })
        deletedCount++
      } catch {
        failedCount++
        failedIds.push(file.external_id)
      }
    }

    const total = allFiles.length
    const result: Record<string, unknown> = {
      deleted_count: deletedCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
      total,
    }

    if (failedIds.length > 0) {
      if (process.exitCode === undefined || process.exitCode === 0) {
        process.exitCode = 1
      }

      return {
        code: 'PARTIAL_DELETE_FAILURE',
        message: 'Some files could not be deleted',
        ...result,
        failed_ids: failedIds,
      }
    }

    return result
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
