import { Cli, z } from 'incur'
import { authVars } from '../../middleware/auth'
import { createApiClient, getApiBaseUrl } from '../../lib/client'
import { loadConfig } from '../../lib/config'
import type { PreSignedConfigReq, PreSignedRespV1 } from '../../types/api'

export const uploadCli = Cli.create('upload', {
  description: 'Upload a file to hStorage',
  vars: authVars,
  args: z.object({
    filePath: z.string().describe('Local file path to upload'),
  }),
  options: z.object({
    downloadLimitCount: z.number().optional().describe('Max download count'),
    password: z.string().optional().describe('Password protection'),
    deleteDate: z.string().optional().describe('Auto-delete date (ISO 8601)'),
    folderUid: z.string().optional().describe('Target folder UID'),
  }),
  run: async (c) => {
    const file = Bun.file(c.args.filePath)

    if (!(await file.exists())) {
      return c.error({
        code: 'FILE_NOT_FOUND',
        message: `File not found: ${c.args.filePath}`,
      })
    }

    let client = c.var.client

    if (!client) {
      const config = await loadConfig()

      if (!config) {
        return c.error({
          code: 'AUTH_REQUIRED',
          message: 'Not logged in. Run `hstorage auth login` to authenticate.',
        })
      }

      client = createApiClient(config, {
        baseUrl: getApiBaseUrl(),
      })
    }

    const requestBody: PreSignedConfigReq = {
      file_name: c.args.filePath.split('/').pop() ?? c.args.filePath,
      is_guest: false,
      is_encrypt: false,
      download_limit_count: c.options.downloadLimitCount,
      password: c.options.password,
      delete_date: c.options.deleteDate,
      folder_uid: c.options.folderUid,
    }

    let presigned: PreSignedRespV1
    try {
      presigned = await client.post<PreSignedRespV1>('/upload/v1/presigned', requestBody)
    } catch (error) {
      return c.error({
        code: 'UPLOAD_REQUEST_FAILED',
        message: error instanceof Error ? error.message : 'Failed to request presigned URL',
      })
    }

    if (!presigned.pre_signed_url) {
      return c.error({
        code: 'UPLOAD_ERROR',
        message: 'No presigned URL returned',
      })
    }

    let uploadResponse: Response
    try {
      const arrayBuffer = await file.arrayBuffer()
      uploadResponse = await fetch(presigned.pre_signed_url, {
        method: 'PUT',
        body: arrayBuffer,
        headers: {
          'content-type': file.type || 'application/octet-stream',
        },
      })
    } catch (error) {
      return c.error({
        code: 'UPLOAD_FAILED',
        message: error instanceof Error ? error.message : 'Upload failed',
      })
    }

    if (!uploadResponse.ok) {
      return c.error({
        code: 'UPLOAD_FAILED',
        message: `Upload failed: ${uploadResponse.statusText}`,
      })
    }

    return {
      external_id: presigned.external_id,
      file_name: presigned.file_name,
      share_url: presigned.share_url,
      direct_url: presigned.direct_url,
    }
  },
})
