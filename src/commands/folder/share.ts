import { Cli, z } from 'incur'
import { authVars } from '../../middleware/auth'
import type {
  FolderShare,
  FolderSharesResponse,
  SharedFoldersResponse,
  ShareFolderRequest,
  SharePermission,
  UpdateShareRequest,
} from '../../types/api'

export const folderShareCli = Cli.create('folder-share', {
  description: 'Folder sharing management',
  vars: authVars,
})

const sharePermissionOptions: [SharePermission, ...SharePermission[]] = ['read', 'edit', 'admin']

folderShareCli.command('shares', {
  description: 'List folder shares',
  options: z.object({
    folderUid: z.string(),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in. Run `hcli auth login` to authenticate.',
      })
    }

    const sharesPath = `/folder/${c.options.folderUid}/shares`
    return client.get<FolderSharesResponse>(sharesPath)
  },
})

folderShareCli.command('share', {
  description: 'Create a folder share',
  options: z.object({
    folderUid: z.string(),
    email: z.string(),
    permission: z.enum(sharePermissionOptions),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in. Run `hcli auth login` to authenticate.',
      })
    }

    const path = `/folder/${c.options.folderUid}/share`
    const requestBody: ShareFolderRequest = {
      email: c.options.email,
      permission: c.options.permission,
    }

    return client.put<FolderShare>(path, requestBody)
  },
})

folderShareCli.command('update-share', {
  description: 'Update a folder share',
  options: z.object({
    folderUid: z.string(),
    shareId: z.string(),
    permission: z.enum(sharePermissionOptions),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in. Run `hcli auth login` to authenticate.',
      })
    }

    const path = `/folder/${c.options.folderUid}/share/${c.options.shareId}`
    const requestBody: UpdateShareRequest = {
      permission: c.options.permission,
    }

    return client.put<FolderShare>(path, requestBody)
  },
})

folderShareCli.command('remove-share', {
  description: 'Remove a folder share',
  options: z.object({
    folderUid: z.string(),
    shareId: z.string(),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in. Run `hcli auth login` to authenticate.',
      })
    }

    return client.delete(`/folder/${c.options.folderUid}/share/${c.options.shareId}`)
  },
})

folderShareCli.command('shared-folders', {
  description: 'List folders shared with me',
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in. Run `hcli auth login` to authenticate.',
      })
    }

    return client.get<SharedFoldersResponse>('/folders/shared')
  },
})
