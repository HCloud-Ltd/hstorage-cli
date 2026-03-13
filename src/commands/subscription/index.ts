import { Cli, z } from 'incur'
import { authVars } from '../../middleware/auth'

export const subscriptionCli = Cli.create('subscription', {
  description: 'Subscription management',
  vars: authVars,
})

subscriptionCli.command('cancel', {
  description: 'Cancel subscription',
  options: z.object({
    type: z.string().describe('Plan type (e.g. premium, business)'),
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
        message: 'Pass --confirm to cancel subscription',
      })
    }

    await client.post(`/subscription?type=${encodeURIComponent(c.options.type)}`)

    return {
      message: 'Subscription cancelled',
      type: c.options.type,
    }
  },
})

subscriptionCli.command('session', {
  description: 'Create Stripe checkout session',
  options: z.object({
    priceId: z.string().describe('Stripe price ID'),
  }),
  run: async (c) => {
    const client = c.var.client

    if (!client) {
      return c.error({
        code: 'AUTH_REQUIRED',
        message: 'Not logged in',
      })
    }

    const result = await client.get<{ url?: string }>('/subscription/session', {
      price_id: c.options.priceId,
    })

    return {
      url: result.url,
    }
  },
})
