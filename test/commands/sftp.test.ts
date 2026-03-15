import { afterEach, expect, test } from 'bun:test'
import { Cli, middleware } from 'incur'
import { createMockServer, type Route } from '../helpers/mock-server'
import { testConfig } from '../helpers/fixtures'
import { authVars } from '../../src/middleware/auth'
import { createApiClient } from '../../src/lib/client'
import { sftpCli } from '../../src/commands/sftp'

let server = createMockServer([])

afterEach(() => {
  server.stop()
})

function setupCli(routes: Route[]) {
  server = createMockServer([
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
    .command(sftpCli)
}

async function runSftpCommand(args: string[], routes: Route[]) {
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

test('permission updates insecure flag', async () => {
  const response = await runSftpCommand(
    [
      'sftp',
      'permission',
      '--insecure',
      'true',
      '--format',
      'json',
    ],
    [
      {
        method: 'POST',
        path: '/sftp/permission',
        body: { ok: true },
      },
    ],
  )

  const payload = JSON.parse(response.output)

  expect(response.exitCalled).toBe(false)
  expect(response.exitCode).toBe(0)
  expect(payload).toEqual({ ok: true })
  expect(server.requests[0]).toMatchObject({
    method: 'POST',
    path: '/sftp/permission',
    body: { insecure: true },
  })
})
