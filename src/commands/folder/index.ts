import { Cli, z } from 'incur'
import { getApiBaseUrl } from '../../lib/client'
import { authVars } from '../../middleware/auth'
import type {
  Folder,
  FolderResponse,
  FolderTreeResponse,
  CreateFolderRequest,
  UpdateFolderRequest,
  OkResponse,
} from '../../types/api'

export const folderCli = Cli.create('folder', {
  description: 'Folder management',
  vars: authVars,
})

folderCli.command('list', {
  description: 'List folders',
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    return client.get<FolderTreeResponse>('/folders')
  },
})

folderCli.command('get', {
  description: 'Get folder by UID',
  args: z.object({
    uid: z.string().describe('Folder UID'),
  }),
  options: z.object({
    password: z.string().optional(),
  }),
  run: async (c) => {
    const params: Record<string, string> = {
      uid: c.args.uid,
    }

    if (c.options.password) {
      params.password = c.options.password
    }

    if (c.var.client) {
      return await c.var.client.get<FolderResponse>('/folder', params)
    }

    const url = new URL(`${getApiBaseUrl()}/folder`)
    url.searchParams.set('uid', c.args.uid)

    if (c.options.password) {
      url.searchParams.set('password', c.options.password)
    }

    const res = await fetch(url.toString())

    if (!res.ok) {
      return c.error({
        code: 'FOLDER_NOT_FOUND',
        message: 'Folder not found',
      })
    }

    return (await res.json()) as FolderResponse
  },
})

folderCli.command('create', {
  description: 'Create folder',
  options: z.object({
    name: z.string(),
    parentId: z.number().optional(),
    publicView: z.boolean().optional(),
    publicUpload: z.boolean().optional(),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    const requestBody: CreateFolderRequest = {
      name: c.options.name,
      ...(c.options.parentId !== undefined ? { parent_id: c.options.parentId } : {}),
      ...(c.options.publicView !== undefined ? { is_public_view: c.options.publicView } : {}),
      ...(c.options.publicUpload !== undefined ? { is_public_upload: c.options.publicUpload } : {}),
    }

    return await client.put<Folder>('/folder', requestBody)
  },
})

folderCli.command('update', {
  description: 'Update folder',
  options: z.object({
    id: z.number(),
    name: z.string().optional(),
    parentId: z.number().optional(),
    publicView: z.boolean().optional(),
    publicUpload: z.boolean().optional(),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    const requestBody: UpdateFolderRequest = {
      id: c.options.id,
      ...(c.options.name !== undefined ? { name: c.options.name } : {}),
      ...(c.options.parentId !== undefined ? { parent_id: c.options.parentId } : {}),
      ...(c.options.publicView !== undefined ? { is_public_view: c.options.publicView } : {}),
      ...(c.options.publicUpload !== undefined ? { is_public_upload: c.options.publicUpload } : {}),
    }

    return await client.post<Folder>('/folder', requestBody)
  },
})

folderCli.command('delete', {
  description: 'Delete folder',
  options: z.object({
    id: z.number(),
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

    return await client.delete<OkResponse>('/folder', {
      id: c.options.id,
    })
  },
})
