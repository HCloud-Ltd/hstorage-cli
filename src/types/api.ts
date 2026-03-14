// OpenAPI spec の components/schemas から変換した TypeScript 型定義

export interface PostmanReq {
  api_key: string
  secret_key: string
}

export interface PostmanRes {
  api_key: string
  nonce: string
}

export interface PreSignedConfigReq {
  file_name: string
  is_guest?: boolean
  is_encrypt?: boolean
  download_limit_count?: number
  password?: string
  delete_date?: string
  folder_uid?: string
}

export interface PreSignedRespV1 {
  external_id?: string
  file_name?: string
  share_url?: string
  direct_url?: string
  presigned_url?: string
  sseKey?: string
  sseMD5?: string
}

export interface Upload {
  id?: number
  external_id?: string
  user_id?: string
  folder_id?: number | null
  original_file_name?: string
  file_name?: string
  file_type?: 'image' | 'video' | 'audio' | 'document' | 'other'
  file_size?: number
  is_premium?: boolean
  is_business?: boolean
  is_onetime?: boolean
  is_encrypt?: boolean
  is_owner?: boolean
  download_limit_count?: number
  download_count?: number
  show_count?: number
  password?: string
  delete_date?: string
  uploaded_by?: 'api' | 'web' | 'sftp'
  created_at?: string
  updated_at?: string
  url?: string
  download_url?: string
  folder?: Folder
}

export interface GetFilesResponse {
  files: Upload[]
  has_more: boolean
  total: number
}

export interface Folder {
  id?: number
  uid?: string
  parent_id?: number | null
  name?: string
  path?: string
  depth?: number
  is_public_view?: boolean
  is_public_upload?: boolean
  created_at?: string
  updated_at?: string
  parent?: Folder
  children?: Folder[]
  uploads?: Upload[]
  file_count?: number
  total_size?: number
}

export interface CreateFolderRequest {
  name: string
  parent_id?: number | null
  is_public_view?: boolean
  is_public_upload?: boolean
}

export interface UpdateFolderRequest {
  id: number
  name?: string
  parent_id?: number | null
  is_public_view?: boolean
  is_public_upload?: boolean
}

export interface MoveFileRequest {
  external_id: string
  target_folder_id?: number | null
}

export interface FolderResponse {
  folder?: Folder
  uploads?: Upload[]
  subfolders?: Folder[]
}

export interface FolderTreeResponse {
  folders?: Folder[]
  root_files?: Upload[]
  shared_folders?: SharedFolderItem[]
}

export type SharePermission = 'read' | 'edit' | 'admin'

export interface ShareFolderRequest {
  email: string
  permission: SharePermission
}

export interface UpdateShareRequest {
  permission: SharePermission
}

export interface FolderShare {
  id?: number
  uid?: string
  folder_id?: number
  shared_by_user_id?: string
  shared_to_user_id?: string
  shared_to_email?: string
  permission?: SharePermission
  created_at?: string
  updated_at?: string
  shared_by_email?: string
  folder_name?: string
  folder_path?: string
  folder_uid?: string
}

export interface FolderShareResponse {
  share?: FolderShare
}

export interface FolderSharesResponse {
  shares?: FolderShare[]
  total?: number
}

export interface SharedFolderItem {
  folder_id?: number
  folder_uid?: string
  folder_name?: string
  folder_path?: string
  permission?: SharePermission
  shared_by_email?: string
  shared_at?: string
}

export interface SharedFoldersResponse {
  folders?: SharedFolderItem[]
  total?: number
}

export interface APIInfo {
  key: string
  secret: string
}

export interface Usage {
  count: number
  total_size: number
}

export interface LoginInit {
  need_link: boolean
  sftp_private_key?: string
  webdav_password?: string
  api: APIInfo
  usage: Usage
  subscription: 'business' | 'premium' | 'onetime' | 'free'
  storage_limit_bytes: number
  storage_remaining_bytes: number
}

export interface UserSetting {
  user_id?: string
  enable_auto_delete?: boolean
  automatic_deletion_seconds?: number
  enable_auto_password?: boolean
  password?: string
  enable_auto_encryption?: boolean
  enable_download_notification?: boolean
  enable_sftp_insecure_permission?: boolean
}

export interface TeamRecord {
  id?: number
  leader_user_id?: string
  leader_user_email?: string
  member_user_id?: string
  member_user_email?: string
  status?: number
  allocated_storage_bytes?: number
  created_at?: string
  updated_at?: string
}

export interface TeamResponse {
  leader?: TeamRecord
  members?: TeamRecord[]
}

export type TeamInviteRequest = TeamInviteItem[]

export interface TeamInviteItem {
  name: string
  email: string
  allocated_storage_bytes?: number
}

export interface TeamMemberStorageItem {
  user_id?: string
  email?: string
  allocated_bytes?: number
  used_bytes?: number
}

export interface TeamStorageResponse {
  leader_total_bytes: number
  allocated_total_bytes: number
  leader_remaining_bytes: number
  leader_used_bytes: number
  members?: TeamMemberStorageItem[]
}

export interface UpdateMemberStorageRequest {
  user_id: string
  allocated_storage_bytes: number
}

export interface UpdatePermissionRequest {
  insecure: boolean
}

export interface OkResponse {
  ok?: boolean
}

export interface ApiError {
  error: {
    code: string
    message: string
  }
}

export interface ErrorMsg {
  title: string
  msg: string
  error: string
}

export interface RateLimitError {
  error: string
  message: string
  retry_after: number
}

export interface SurveyAttributes {
  reason?: string[]
  'reason-Comment'?: string
}
