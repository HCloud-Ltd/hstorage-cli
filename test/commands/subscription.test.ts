import { afterEach, expect, test } from 'bun:test'
import { Cli, middleware } from 'incur'
import { createMockServer, type Route } from '../helpers/mock-server'
import { testConfig, testNonceResponse } from '../helpers/fixtures'
import { authVars } from '../../src/middleware/auth'
import { createApiClient } from '../../src/lib/client'
import { subscriptionCli } from '../../src/commands/subscription'

let server = createMockServer([])

afterEach(() => {
  server.stop()
})

function setupCli(routes: Route[]) {
  server = createMockServer([
    {
      method: 'POST',
      path: '/api/generate-crypto-key',
      body: testNonceResponse,
    },
    ...routes,
  ])

  const client = createApiClient(testConfig, { baseUrl: server.url })

  return Cli.create('test', { vars: authVars })
    .use(
      middleware<typeof authVars>(async (c, next) => {
        c.set('client', client)
        return next()
      }),
    )
    .command(subscriptionCli)
}

async function runSubscriptionCommand(args: string[], routes: Route[]) {
  const outputs: string[] = []
  let exitCalled = false
  let exitCode = 0

  await setupCli(routes).serve(args, {
    stdout: (s) => outputs.push(s),
    exit: (code) => {
      exitCalled = true
      exitCode = code
    },
  })

  return {
    output: outputs.join(''),
    exitCalled,
    exitCode,
  }
}

test('cancel without confirm returns confirmation error', async () => {
  const response = await runSubscriptionCommand(
    ['subscription', 'cancel', '--type', 'premium', '--format', 'json'],
    [],
  )
  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(true)
  expect(response.exitCode).toBe(1)
  expect(payload).toEqual({
    code: 'CONFIRMATION_REQUIRED',
    message: 'Pass --confirm to cancel subscription',
  })
})

test('cancel with confirm posts subscription cancellation', async () => {
  const response = await runSubscriptionCommand(
    [
      'subscription',
      'cancel',
      '--type',
      'premium',
      '--confirm',
      'true',
      '--format',
      'json',
    ],
    [
      {
        method: 'POST',
        path: '/subscription',
        body: { message: 'Subscription cancelled' },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload).toEqual({
    message: 'Subscription cancelled',
    type: 'premium',
  })
  expect(server.requests[1]).toMatchObject({
    method: 'POST',
    path: '/subscription',
    body: null,
  })
})

test('session returns checkout URL', async () => {
  const response = await runSubscriptionCommand(
    [
      'subscription',
      'session',
      '--price-id',
      'price_123',
      '--format',
      'json',
    ],
    [
      {
        method: 'GET',
        path: '/subscription/session',
        body: {
          url: 'https://checkout.hstorage.io/session',
          ok: true,
        },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(payload.url).toBe('https://checkout.hstorage.io/session')
  expect(server.requests[1]).toMatchObject({
    method: 'GET',
    path: '/subscription/session',
    body: null,
  })
})
