import { Cli, z } from 'incur'
import { join } from 'node:path'
import { authVars } from '../../middleware/auth'
import type { Upload } from '../../types/api'

interface ClientErrorResponse {
  error: {
    code?: string
    message?: string
  }
}

function getClientErrorMessage(error: unknown): { code: string; message: string } | null {
  if (!(error instanceof Error)) {
    return null
  }

  const maybeError = error as ClientErrorResponse & Error
  if (
    'error' in maybeError
    && typeof maybeError.error === 'object'
    && maybeError.error !== null
    && typeof maybeError.error.code === 'string'
    && typeof maybeError.error.message === 'string'
  ) {
    return {
      code: maybeError.error.code,
      message: maybeError.error.message,
    }
  }

  return null
}

export const downloadCli = Cli.create('download', {
  description: 'Download a file from hStorage',
  vars: authVars,
  args: z.object({
    externalId: z.string().describe('File external ID'),
  }),
  options: z.object({
    output: z.string().optional().describe('Output file path'),
    password: z.string().optional().describe('File password'),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    const params: Record<string, string> = {
      external_id: c.args.externalId,
    }

    if (c.options.password) {
      params.password = c.options.password
    }

    let fileInfo: Upload
    try {
      fileInfo = await client.get<Upload>('/file/info', params)
    } catch (error) {
      const clientError = getClientErrorMessage(error)

      return c.error({
        code: clientError?.code ?? 'FILE_INFO_FAILED',
        message: clientError?.message
          ?? (error instanceof Error ? error.message : 'Failed to fetch file info'),
      })
    }

    const downloadUrl = fileInfo.download_url
      ?? (fileInfo.url ? `${fileInfo.url}?download=true` : null)

    if (!downloadUrl) {
      return c.error({
        code: 'NO_DOWNLOAD_URL',
        message: 'No download URL available',
      })
    }

    const fileName = fileInfo.original_file_name ?? fileInfo.file_name ?? c.args.externalId
    const outputPath = c.options.output ?? join(process.cwd(), fileName)

    let downloadResponse: Response
    try {
      downloadResponse = await fetch(downloadUrl)
    } catch (error) {
      return c.error({
        code: 'DOWNLOAD_FAILED',
        message: error instanceof Error ? error.message : 'Download failed',
      })
    }

    if (!downloadResponse.ok) {
      return c.error({
        code: 'DOWNLOAD_FAILED',
        message: `Download failed: ${downloadResponse.statusText}`,
      })
    }

    try {
      const buffer = await downloadResponse.arrayBuffer()
      await Bun.write(outputPath, buffer)
    } catch (error) {
      return c.error({
        code: 'DOWNLOAD_FAILED',
        message: error instanceof Error ? error.message : 'Failed to save downloaded file',
      })
    }

    return {
      file_name: fileInfo.file_name,
      original_file_name: fileInfo.original_file_name,
      file_size: fileInfo.file_size,
      saved_to: outputPath,
    }
  },
})
