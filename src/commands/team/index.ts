import { Cli, z } from 'incur'
import { authVars } from '../../middleware/auth'
import type {
  TeamResponse,
  TeamInviteItem,
  TeamStorageResponse,
  UpdateMemberStorageRequest,
} from '../../types/api'

export const teamCli = Cli.create('team', {
  description: 'Team management',
  vars: authVars,
})

teamCli.command('info', {
  description: 'Show team information',
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    return client.get<TeamResponse>('/team')
  },
})

teamCli.command('invite', {
  description: 'Invite a team member',
  options: z.object({
    name: z.string(),
    email: z.string(),
    allocatedStorageBytes: z.number().optional(),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    const requestBody: TeamInviteItem = {
      name: c.options.name,
      email: c.options.email,
      ...(c.options.allocatedStorageBytes !== undefined
        ? { allocated_storage_bytes: c.options.allocatedStorageBytes }
        : {}),
    }

    return client.post('/team/invite', [requestBody])
  },
})

teamCli.command('remove-member', {
  description: 'Remove a team member',
  args: z.object({
    userId: z.string().describe('Member user ID'),
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
        message: 'Pass --confirm to remove member',
      })
    }

    return client.delete('/team/member', {
      user_id: c.args.userId,
    })
  },
})

teamCli.command('storage', {
  description: 'Show team storage status',
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    return client.get<TeamStorageResponse>('/team/storage')
  },
})

teamCli.command('update-storage', {
  description: 'Update team member storage allocation',
  options: z.object({
    userId: z.string(),
    allocatedStorageBytes: z.number(),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    const requestBody: UpdateMemberStorageRequest = {
      user_id: c.options.userId,
      allocated_storage_bytes: c.options.allocatedStorageBytes,
    }

    return client.put('/team/member/storage', requestBody)
  },
})
