import type { HStorageConfig } from '../../src/types/config'
import type {
  PostmanRes,
  Upload,
  Folder,
  LoginInit,
  TeamResponse,
  GetFilesResponse,
  TeamStorageResponse,
  FolderResponse,
  FolderTreeResponse,
  FolderShare,
  SharedFolderItem,
} from '../../src/types/api'

export const testConfig: HStorageConfig = {
  email: 'test@example.com',
  apiKey: 'test-api-key',
  secretKey: 'test-secret-key-padding-32bytes!',
}

export const testNonceResponse: PostmanRes = {
  api_key: 'test-api-key',
  nonce: 'test-nonce-12345',
}

export const testUpload: Upload = {
  id: 1,
  external_id: 'ext_abc123',
  user_id: 'user-uuid',
  folder_id: 12,
  original_file_name: 'document.pdf',
  file_name: 'abc123.pdf',
  file_type: 'document',
  file_size: 1024000,
  is_premium: false,
  is_business: false,
  is_onetime: false,
  is_encrypt: false,
  is_owner: true,
  download_limit_count: 10,
  download_count: 5,
  show_count: 2,
  password: 'pass123',
  delete_date: '2024-12-31T23:59:59Z',
  uploaded_by: 'api',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-16T12:34:56Z',
  url: 'https://hstorage.example.local/f/abc123',
  download_url: 'https://cdn.hstorage.example.local/abc123.pdf',
}

export const testFolder: Folder = {
  id: 1,
  uid: 'folder-uid-abc',
  parent_id: null,
  name: 'My Folder',
  path: '/my-folder',
  depth: 0,
  is_public_view: false,
  is_public_upload: false,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-16T10:00:00Z',
  parent: undefined,
  children: [],
  uploads: [],
  file_count: 1,
  total_size: 1024000,
}

export const testLoginInit: LoginInit = {
  need_link: false,
  sftp_private_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC7',
  webdav_password: 'webdav-pass-123',
  api: {
    key: 'api-key-xyz',
    secret: 'secret-abc',
  },
  usage: {
    count: 12,
    total_size: 1572864,
  },
  subscription: 'premium',
  storage_limit_bytes: 10737418240,
  storage_remaining_bytes: 9876543,
}

export const testTeamResponse: TeamResponse = {
  leader: {
    id: 1,
    leader_user_id: 'leader-uuid',
    leader_user_email: 'leader@example.com',
    member_user_id: undefined,
    member_user_email: undefined,
    status: 1,
    allocated_storage_bytes: 1073741824,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  members: [
    {
      id: 2,
      leader_user_id: 'leader-uuid',
      leader_user_email: 'leader@example.com',
      member_user_id: 'member-uuid',
      member_user_email: 'member@example.com',
      status: 1,
      allocated_storage_bytes: 524288000,
      created_at: '2024-01-05T00:00:00Z',
      updated_at: '2024-01-20T00:00:00Z',
    },
  ],
}

export const testTeamStorageResponse: TeamStorageResponse = {
  leader_total_bytes: 10737418240,
  allocated_total_bytes: 21474836480,
  leader_remaining_bytes: 10000000000,
  leader_used_bytes: 738741824,
  members: [
    {
      user_id: 'member-uuid',
      email: 'member@example.com',
      allocated_bytes: 524288000,
      used_bytes: 12345,
    },
  ],
}

export const testGetFilesResponse: GetFilesResponse = {
  files: [
    {
      ...testUpload,
      id: 2,
      external_id: 'ext_abc124',
      original_file_name: 'image.png',
      file_name: 'abc124.png',
      file_type: 'image',
    },
  ],
  has_more: false,
  total: 1,
}

export const testFolderResponse: FolderResponse = {
  folder: testFolder,
  uploads: [testUpload],
  subfolders: [
    {
      id: 2,
      uid: 'sub-uid-456',
      parent_id: 1,
      name: 'Sub Folder',
      path: '/my-folder/sub-folder',
      depth: 1,
      is_public_view: true,
      is_public_upload: false,
      created_at: '2024-01-17T10:00:00Z',
      updated_at: '2024-01-18T10:00:00Z',
      file_count: 0,
      total_size: 0,
    },
  ],
}

export const testFolderTreeResponse: FolderTreeResponse = {
  folders: [
    {
      ...testFolder,
      id: 10,
      uid: 'tree-folder-uid',
      name: 'Tree Folder',
      path: '/tree',
      depth: 0,
    },
  ],
  root_files: [testUpload],
  shared_folders: [
    {
      folder_id: 10,
      folder_uid: 'tree-folder-uid',
      folder_name: 'Tree Folder',
      folder_path: '/tree',
      permission: 'read',
      shared_by_email: 'admin@example.com',
      shared_at: '2024-02-01T00:00:00Z',
    },
  ],
}

export const testFolderShare: FolderShare = {
  id: 1,
  uid: 'share-uid-001',
  folder_id: 10,
  shared_by_user_id: 'leader-uuid',
  shared_to_user_id: 'member-uuid',
  shared_to_email: 'member@example.com',
  permission: 'read',
  created_at: '2024-02-03T10:00:00Z',
  updated_at: '2024-02-03T10:00:00Z',
  shared_by_email: 'leader@example.com',
  folder_name: 'Shared Folder',
  folder_path: '/shared',
  folder_uid: 'shared-folder-uid',
}

export const testSharedFolderItem: SharedFolderItem = {
  folder_id: 11,
  folder_uid: 'shared-folder-uid',
  folder_name: 'Shared Folder',
  folder_path: '/shared',
  permission: 'edit',
  shared_by_email: 'owner@example.com',
  shared_at: '2024-02-04T10:00:00Z',
}
