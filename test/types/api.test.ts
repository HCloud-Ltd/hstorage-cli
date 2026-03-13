import { expect, test } from 'bun:test'
import type {
  Upload,
  Folder,
  LoginInit,
  TeamResponse,
  FolderTreeResponse,
  GetFilesResponse,
  CreateFolderRequest,
  MoveFileRequest,
  SharePermission,
  UserSetting,
  TeamStorageResponse,
  UpdatePermissionRequest,
  OkResponse,
  PostmanReq,
  PostmanRes,
  PreSignedConfigReq,
  PreSignedRespV1,
} from '../../src/types/api'
import type { HStorageConfig } from '../../src/types/config'

test('Upload type has required fields', () => {
  const upload: Upload = {
    id: 1,
    external_id: 'abc123',
    file_name: 'test.txt',
    file_type: 'document',
    file_size: 1024,
  }
  expect(upload.file_type).toBe('document')
})

test('LoginInit type has required fields', () => {
  const loginInit: LoginInit = {
    need_link: false,
    api: { key: 'apikey', secret: 'secret' },
    usage: { count: 0, total_size: 0 },
    subscription: 'free',
    storage_limit_bytes: 1073741824,
    storage_remaining_bytes: 1073741824,
  }
  expect(loginInit.subscription).toBe('free')
})

test('HStorageConfig type has required fields', () => {
  const config: HStorageConfig = {
    email: 'test@example.com',
    apiKey: 'key',
    secretKey: 'secret',
  }
  expect(config.email).toBe('test@example.com')
})

test('SharePermission is valid enum', () => {
  const perms: SharePermission[] = ['read', 'edit', 'admin']
  expect(perms).toHaveLength(3)
})

test('TeamResponse type works', () => {
  const team: TeamResponse = {
    leader: { id: 1, leader_user_email: 'leader@example.com' },
    members: [],
  }
  expect(team.members).toHaveLength(0)
})

test('PostmanReq type has required fields', () => {
  const req: PostmanReq = {
    api_key: 'key',
    secret_key: 'secret',
  }
  expect(req.api_key).toBe('key')
})

test('additional api types compile', () => {
  const folder: Folder = { id: 1, name: 'docs' }
  const tree: FolderTreeResponse = { folders: [folder], root_files: [], shared_folders: [] }
  const files: GetFilesResponse = { files: [], has_more: false, total: 0 }
  const createFolderRequest: CreateFolderRequest = { name: 'new-folder', parent_id: null }
  const moveFileRequest: MoveFileRequest = { external_id: 'abc123', target_folder_id: null }
  const userSetting: UserSetting = { enable_auto_delete: true }
  const teamStorage: TeamStorageResponse = {
    leader_total_bytes: 10,
    allocated_total_bytes: 5,
    leader_remaining_bytes: 5,
    leader_used_bytes: 5,
    members: [],
  }
  const updatePermissionRequest: UpdatePermissionRequest = { insecure: false }
  const okResponse: OkResponse = { ok: true }
  const postmanRes: PostmanRes = { api_key: 'key', nonce: 'nonce' }
  const preSignedConfigReq: PreSignedConfigReq = { file_name: 'file.txt' }
  const preSignedResp: PreSignedRespV1 = { external_id: 'id', pre_signed_url: 'https://example.com' }

  expect(tree.folders?.[0]?.name).toBe('docs')
  expect(files.total).toBe(0)
  expect(createFolderRequest.name).toBe('new-folder')
  expect(moveFileRequest.external_id).toBe('abc123')
  expect(userSetting.enable_auto_delete).toBe(true)
  expect(teamStorage.leader_total_bytes).toBe(10)
  expect(updatePermissionRequest.insecure).toBe(false)
  expect(okResponse.ok).toBe(true)
  expect(postmanRes.nonce).toBe('nonce')
  expect(preSignedConfigReq.file_name).toBe('file.txt')
  expect(preSignedResp.external_id).toBe('id')
})
