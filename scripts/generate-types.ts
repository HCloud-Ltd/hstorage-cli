#!/usr/bin/env bun

import { parse } from 'yaml'
import { resolve, dirname } from 'path'

const DEFAULT_OPENAPI_PATH = resolve(
  dirname(import.meta.dir),
  '../hstorage-api/openapi.yaml'
)

const OUTPUT_PATH = resolve(
  dirname(import.meta.dir),
  'src/types/api.ts'
)

const SCHEMA_ORDER = [
  'PostmanReq',
  'PostmanRes',
  'PreSignedConfigReq',
  'PreSignedRespV1',
  'Upload',
  'GetFilesResponse',
  'Folder',
  'CreateFolderRequest',
  'UpdateFolderRequest',
  'MoveFileRequest',
  'FolderResponse',
  'FolderTreeResponse',
  'SharePermission',
  'ShareFolderRequest',
  'UpdateShareRequest',
  'FolderShare',
  'FolderShareResponse',
  'FolderSharesResponse',
  'SharedFolderItem',
  'SharedFoldersResponse',
  'APIInfo',
  'Usage',
  'LoginInit',
  'UserSetting',
  'TeamRecord',
  'TeamResponse',
  'TeamInviteRequest',
  'TeamInviteItem',
  'TeamMemberStorageItem',
  'TeamStorageResponse',
  'UpdateMemberStorageRequest',
  'UpdatePermissionRequest',
  'OkResponse',
  'Error',
  'RateLimitError',
  'SurveyAttributes',
]

const SCHEMA_RENAMES: Record<string, string> = {
  Error: 'ApiError',
}

// API response field names differ from spec for these schemas
const FIELD_RENAMES: Record<string, Record<string, string>> = {
  PreSignedRespV1: {
    pre_signed_url: 'presigned_url',
    sse_key: 'sseKey',
    sse_md5: 'sseMD5',
  },
}

// Deprecated or internal-only fields excluded from CLI types
const SKIP_FIELDS: Record<string, Set<string>> = {
  Upload: new Set(['group_id', 's3_key', 'folder']),
  PreSignedConfigReq: new Set(['group_uid']),
}

// Computed fields returned by API but absent from OpenAPI spec
const EXTRA_FIELDS: Record<string, Array<{ name: string; type: string; optional: boolean }>> = {
  Upload: [
    { name: 'url', type: 'string', optional: true },
    { name: 'download_url', type: 'string', optional: true },
    { name: 'folder', type: 'Folder', optional: true },
  ],
}

// Force optional for fields that are required in spec but optional in practice
const FORCE_OPTIONAL: Record<string, Set<string>> = {
  TeamStorageResponse: new Set(['members']),
}

// Force required for nested object fields (overrides spec when it lacks nested required)
const FORCE_REQUIRED_NESTED: Record<string, Record<string, Set<string>>> = {
  Error: { error: new Set(['code', 'message']) },
}

const EXTRA_TYPES = `\
export interface ErrorMsg {
  title: string
  msg: string
  error: string
}
`

interface SchemaProperty {
  type?: string
  format?: string
  $ref?: string
  allOf?: SchemaProperty[]
  items?: SchemaProperty
  enum?: string[]
  nullable?: boolean
  properties?: Record<string, SchemaProperty>
  required?: string[]
}

function extractRefName(ref: string): string {
  const name = ref.split('/').pop()!
  return SCHEMA_RENAMES[name] || name
}

function resolveType(prop: SchemaProperty, indent: number): string {
  if (prop.$ref) {
    return extractRefName(prop.$ref)
  }

  if (prop.allOf && prop.allOf.length === 1 && prop.allOf[0].$ref) {
    return extractRefName(prop.allOf[0].$ref)
  }

  if (prop.enum) {
    return prop.enum.map(v => `'${v}'`).join(' | ')
  }

  if (prop.type === 'array' && prop.items) {
    return `${resolveType(prop.items, indent)}[]`
  }

  if (prop.type === 'object' && prop.properties) {
    return generateInlineObject(prop, indent)
  }

  if (prop.type === 'string') return 'string'
  if (prop.type === 'integer' || prop.type === 'number') return 'number'
  if (prop.type === 'boolean') return 'boolean'

  return 'unknown'
}

function needsQuote(name: string): boolean {
  return !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)
}

function formatFieldName(name: string): string {
  return needsQuote(name) ? `'${name}'` : name
}

function generateInlineObject(
  schema: SchemaProperty,
  indent: number,
  forceRequired?: Set<string>
): string {
  const pad = ' '.repeat(indent)
  const innerPad = ' '.repeat(indent + 2)
  const required = new Set([...(schema.required || []), ...(forceRequired || [])])
  const lines: string[] = ['{']

  for (const [name, prop] of Object.entries(schema.properties || {})) {
    const opt = required.has(name) ? '' : '?'
    const type = resolveType(prop, indent + 2)
    lines.push(`${innerPad}${formatFieldName(name)}${opt}: ${type}`)
  }

  lines.push(`${pad}}`)
  return lines.join('\n')
}

function generateInterface(
  tsName: string,
  schema: SchemaProperty,
  schemaName: string
): string {
  const required = new Set(schema.required || [])
  const skip = SKIP_FIELDS[schemaName] || new Set()
  const forceOpt = FORCE_OPTIONAL[schemaName] || new Set()
  const renames = FIELD_RENAMES[schemaName] || {}
  const extras = EXTRA_FIELDS[schemaName] || []
  const nestedRequired = FORCE_REQUIRED_NESTED[schemaName] || {}

  const lines: string[] = [`export interface ${tsName} {`]

  for (const [specFieldName, prop] of Object.entries(schema.properties || {})) {
    if (skip.has(specFieldName)) continue

    const fieldName = renames[specFieldName] || specFieldName
    const isRequired = required.has(specFieldName) && !forceOpt.has(specFieldName)
    const opt = isRequired ? '' : '?'
    const p = prop as SchemaProperty

    let type: string
    if (p.type === 'object' && p.properties && nestedRequired[specFieldName]) {
      type = generateInlineObject(p, 2, nestedRequired[specFieldName])
    } else {
      type = resolveType(p, 2)
    }

    if (p.nullable) {
      type = `${type} | null`
    }

    lines.push(`  ${formatFieldName(fieldName)}${opt}: ${type}`)
  }

  for (const extra of extras) {
    const opt = extra.optional ? '?' : ''
    lines.push(`  ${formatFieldName(extra.name)}${opt}: ${extra.type}`)
  }

  lines.push('}')
  return lines.join('\n')
}

function generateEnumType(tsName: string, schema: SchemaProperty): string {
  const values = (schema.enum || []).map(v => `'${v}'`).join(' | ')
  return `export type ${tsName} = ${values}`
}

function generateArrayAlias(tsName: string, schema: SchemaProperty): string {
  return `export type ${tsName} = ${resolveType(schema.items!, 0)}[]`
}

async function main() {
  const openapiPath = process.argv[2]
    || process.env.OPENAPI_PATH
    || DEFAULT_OPENAPI_PATH

  const file = Bun.file(openapiPath)
  if (!await file.exists()) {
    if (await Bun.file(OUTPUT_PATH).exists()) {
      console.log('✓ OpenAPI spec not found, using existing api.ts')
      process.exit(0)
    }
    console.error(`OpenAPI spec not found: ${openapiPath}`)
    console.error('Usage: bun scripts/generate-types.ts [path-to-openapi.yaml]')
    console.error('Or set OPENAPI_PATH environment variable')
    process.exit(1)
  }

  const yamlContent = await file.text()
  const spec = parse(yamlContent) as { components: { schemas: Record<string, SchemaProperty> } }
  const schemas = spec.components.schemas

  const output: string[] = [
    '// Auto-generated from OpenAPI spec — DO NOT EDIT',
    '// Run `bun run generate:types` to regenerate',
    '',
  ]

  for (const schemaName of SCHEMA_ORDER) {
    const schema = schemas[schemaName]
    if (!schema) {
      console.warn(`Warning: schema '${schemaName}' not found in spec`)
      continue
    }

    const tsName = SCHEMA_RENAMES[schemaName] || schemaName

    if (schema.type === 'string' && schema.enum) {
      output.push(generateEnumType(tsName, schema))
    } else if (schema.type === 'array') {
      output.push(generateArrayAlias(tsName, schema))
    } else {
      output.push(generateInterface(tsName, schema, schemaName))
    }

    output.push('')
  }

  output.push(EXTRA_TYPES)

  await Bun.write(OUTPUT_PATH, output.join('\n'))
  console.log(`✓ Generated ${OUTPUT_PATH}`)
}

main().catch((err) => {
  console.error('Failed to generate types:', err)
  process.exit(1)
})
