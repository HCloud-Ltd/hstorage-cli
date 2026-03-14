import { Cli, z } from 'incur'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import type { PutObjectCommandInput } from '@aws-sdk/client-s3'
import { authVars } from '../../middleware/auth'
import { createApiClient, getApiBaseUrl } from '../../lib/client'
import { loadConfig } from '../../lib/config'
import type { PreSignedConfigReq, PreSignedRespV1 } from '../../types/api'

function parsePresignedUrl(presignedUrl: string) {
  const url = new URL(presignedUrl)
  const pathParts = url.pathname.split('/').filter(Boolean)
  return {
    endpoint: `${url.protocol}//${url.host}`,
    bucket: pathParts[0],
    key: decodeURIComponent(pathParts.slice(1).join('/')),
    searchParams: Object.fromEntries(url.searchParams),
  }
}

function createPresignedS3Client(presignedUrl: string) {
  const { endpoint, bucket, key, searchParams } = parsePresignedUrl(presignedUrl)

  const client = new S3Client({
    endpoint,
    region: 'auto',
    forcePathStyle: true,
    maxAttempts: 1,
    credentials: {
      accessKeyId: 'presigned',
      secretAccessKey: 'presigned',
    },
  })

  client.middlewareStack.add(
    (next) => async (args) => {
      const request = args.request as Record<string, any>
      delete request.headers['authorization']
      delete request.headers['x-amz-content-sha256']
      delete request.headers['x-amz-security-token']
      delete request.headers['x-amz-date']
      request.query = { ...request.query, ...searchParams }
      return next(args)
    },
    {
      step: 'finalizeRequest',
      priority: 'low',
      name: 'presignedUrlAuth',
      override: true,
    },
  )

  return { client, bucket, key }
}

export const uploadCli = Cli.create('upload', {
  description: 'Upload a file to HStorage',
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

    if (!presigned.presigned_url) {
      return c.error({
        code: 'UPLOAD_ERROR',
        message: 'No presigned URL returned',
      })
    }

    const { client: s3Client, bucket, key } = createPresignedS3Client(presigned.presigned_url)

    const putParams: PutObjectCommandInput = {
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type || 'application/octet-stream',
    }

    if (presigned.sseKey) {
      putParams.SSECustomerAlgorithm = 'AES256'
      putParams.SSECustomerKey = presigned.sseKey
      putParams.SSECustomerKeyMD5 = presigned.sseMD5
    }

    try {
      await s3Client.send(new PutObjectCommand(putParams))
    } catch (error) {
      return c.error({
        code: 'UPLOAD_FAILED',
        message: error instanceof Error
          ? `Upload failed: ${error.message}`
          : 'Upload failed',
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
