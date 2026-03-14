# AGENTS.md — hstorage-cli

CLI client for HStorage file management service. Built with Bun + TypeScript + incur (CLI framework).

## External References

- OpenAPI spec: `~/ghq/github.com/rluisr/hstorage-api/openapi.yaml`
- API types in `src/types/api.ts` are derived from the OpenAPI spec above

## Build / Run / Test

```bash
# Install dependencies
bun install

# Run in development
bun run src/index.ts

# Build native binary
bun build --compile src/index.ts --outfile hcli

# Run all tests (99 tests across 22 files)
bun test

# Run a single test file
bun test test/commands/auth.test.ts

# Run tests matching a pattern
bun test --filter "login success"

# Run a test directory
bun test test/e2e/
bun test test/commands/
```

There is no linter or formatter configured. No eslint, no prettier, no biome. Follow the existing code style exactly.

## Runtime: Bun (NOT Node.js)

- `bun <file>` not `node`/`ts-node`
- `bun test` not `jest`/`vitest`
- `bun install` not `npm`/`yarn`/`pnpm`
- `Bun.file()` / `Bun.write()` not `fs.readFile`/`fs.writeFile`
- `Bun.serve()` not `express`
- Bun auto-loads `.env` — never use `dotenv`

## Project Structure

```
src/
  index.ts              # CLI entrypoint — registers all commands
  commands/
    auth/index.ts       # login, logout, status
    file/index.ts       # list, info, update, delete, move, email
    file/upload.ts       # file upload with presigned URL
    file/download.ts     # file download
    folder/index.ts      # CRUD for folders
    folder/share.ts      # folder sharing (share, update, remove, list)
    sftp/index.ts        # SFTP key management
    team/index.ts        # team management (invite, remove, storage)
    user/index.ts        # user info, settings, delete
    subscription/index.ts
  lib/
    client.ts           # API client (nonce auth, request helpers)
    config.ts           # Credential storage (~/.config/hstorage/)
  middleware/
    auth.ts             # Auth middleware — loads config, creates client
  types/
    api.ts              # API response/request types (from OpenAPI spec)
    config.ts           # HStorageConfig interface
test/
  commands/             # Unit tests per command
  lib/                  # Unit tests for client, config
  middleware/           # Auth middleware tests
  types/               # Type validation tests
  security/            # Secret redaction tests
  e2e/                 # End-to-end flow tests
  helpers/
    fixtures.ts         # Shared test data (testConfig, testUpload, etc.)
    mock-server.ts      # Bun.serve() mock HTTP server
```

## Code Style

### Formatting
- **No semicolons** — the entire codebase omits them
- **Single quotes** for strings
- **2-space indentation**
- **No trailing commas** in single-line; trailing commas in multi-line

### Imports
- Use `import type { ... }` for type-only imports (separate from value imports)
- Group order: node builtins → external packages → local modules → types
- `incur` re-exports `z` from Zod: `import { Cli, z } from 'incur'`

```typescript
import { Cli, z } from 'incur'
import { authVars } from '../../middleware/auth'
import type { GetFilesResponse, Upload } from '../../types/api'
```

### Types & Interfaces
- Use `interface` for object shapes (API types, configs)
- Use `type` for aliases and unions
- Explicit return types on exported functions
- API types use `snake_case` fields (matching JSON wire format)
- TypeScript options use `camelCase` (matching CLI conventions)
- `strict: true` in tsconfig — no `as any`, no `@ts-ignore`, no `@ts-expect-error`

### Naming Conventions
- CLI instances: `camelCaseCli` (e.g., `folderShareCli`, `authCli`, `fileCli`)
- Export named, not default (e.g., `export const authCli = ...`, `export { cli }`)
- Error codes: `UPPER_SNAKE_CASE` (e.g., `AUTH_REQUIRED`, `FILE_NOT_FOUND`)
- API paths: lowercase with slashes (e.g., `/folder/${uid}/share`)

### CLI Command Pattern (incur)

```typescript
import { Cli, z } from 'incur'
import { authVars } from '../../middleware/auth'

export const exampleCli = Cli.create('example', {
  description: 'Example command group',
  vars: authVars,
})

exampleCli.command('action', {
  description: 'Do something',
  args: z.object({ id: z.string().describe('Resource ID') }),
  options: z.object({ verbose: z.boolean().optional() }),
  run: async (c) => {
    const client = c.var.client
    if (!client) {
      return c.error({ code: 'AUTH_REQUIRED', message: 'Not logged in. Run `hstorage auth login` to authenticate.' })
    }
    return client.get<SomeType>('/path', { id: c.args.id })
  },
})
```

### Error Handling
- Commands return `c.error({ code, message })` for user-facing errors — never throw
- API client methods throw typed errors (`ApiClientError`, `ApiRateLimitClientError`)
- Wrap client calls in try/catch when custom error messages are needed
- Empty catch blocks only for cleanup operations (e.g., `deleteConfig`)
- Use type guards (`isApiError`, `isRateLimitError`) for response discrimination

### API Client Usage
- Always get client via `c.var.client` (set by auth middleware)
- Client methods: `get<T>(path, params?)`, `post<T>(path, body?)`, `put<T>(path, body?)`, `delete<T>(path, params?)`
- Nonce auth is automatic — handled internally by `createApiClient`
- For commands that work without auth (e.g., `folder get`), fall back to raw `fetch`

## Testing Patterns

### Test Framework
- `import { test, expect, beforeEach, afterEach } from 'bun:test'`
- Test timeout: 10000ms (configured in `bunfig.toml`)

### Mock Server Pattern
All API tests use `createMockServer()` from `test/helpers/mock-server.ts`:

```typescript
let server = createMockServer([])

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'hstorage-test-'))
  originalXDG = process.env.XDG_CONFIG_HOME
  originalApiUrl = process.env.HSTORAGE_API_URL
  process.env.XDG_CONFIG_HOME = tmpDir
})

afterEach(async () => {
  server.stop()
  // Restore env vars (check undefined before delete)
  if (originalXDG === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = originalXDG
  await rm(tmpDir, { recursive: true, force: true })
})
```

### CLI Test Execution
Tests invoke commands through the CLI framework, not direct function calls:

```typescript
async function runCommand(args: string[]) {
  const outputs: string[] = []
  let exitCode = 0
  let exitCalled = false
  await buildCli().serve(args, {
    exit: (code) => { exitCalled = true; exitCode = code },
    stdout: (s) => { outputs.push(s) },
  })
  return { output: outputs.join(''), exitCalled, exitCode }
}
```

### Shared Fixtures
Use `test/helpers/fixtures.ts` for test data (`testConfig`, `testNonceResponse`, `testUpload`, `testFolder`, etc.). Never inline test data that already exists as a fixture.

### Test File Naming
- Unit tests: `test/<module>/<name>.test.ts` mirroring `src/` structure
- E2E tests: `test/e2e/<flow-name>.test.ts`
- Test helpers: `test/helpers/` (not test files themselves, except `mock-server.test.ts`)
