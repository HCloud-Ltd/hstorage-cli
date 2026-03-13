import { test, expect } from 'bun:test'
import { Cli, middleware } from 'incur'
import { createMockServer } from './helpers/mock-server'
import { testConfig, testNonceResponse, testFolderShare } from './helpers/fixtures'
import { authVars } from '../src/middleware/auth'
import { createApiClient } from '../src/lib/client'
import { folderShareCli } from '../src/commands/folder/share'

test('debug shares', async () => {
  const server = createMockServer([
    { method: 'POST', path: '/api/generate-crypto-key', body: testNonceResponse },
    { method: 'GET', path: '/folder/folder-uid-abc/shares', body: { shares: [testFolderShare], total: 1 } },
  ])

  const client = createApiClient(testConfig, { baseUrl: server.url })

  const cli = Cli.create('test', { vars: authVars })
    .use(middleware<typeof authVars>(async (c, next) => {
      c.set('client', client)
      return next()
    }))
    .command(folderShareCli)

  const outputs: string[] = []
  let exitCalled = false
  let exitCode = 0

  await cli.serve(['folder-share', 'shares', '--folder-uid', 'folder-uid-abc', '--format', 'json'], {
    stdout: (s) => outputs.push(s),
    exit: (code) => { exitCalled = true; exitCode = code },
  })

  console.log('output:', outputs.join(''))
  console.log('exitCalled:', exitCalled)
  console.log('exitCode:', exitCode)

  server.stop()
})
