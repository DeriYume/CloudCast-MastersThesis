import type { SharePermission as ContractSharePermission } from "./contract.generated";

export type SharePermission = ContractSharePermission;

export type Permission = SharePermission | "owner";

export interface FileItem {
  id: string;
  folder_id: string | null;
  original_name: string;
  meta_enc?: string | null;
  wrapped_dek?: string | null;
  meta_sealed?: string | null;

  mime_type: string;
  size_bytes: number | string;

  is_favorite: boolean;
  expires_at: string | null;
  created_at: string;
  folder_name?: string | null;

  permission?: Permission;

  shared_by?: string;
  share_expires_at?: string | null;
}

export interface FolderItem {
  id: string;
  parent_id: string | null;
  name: string;
  name_enc?: string | null;
  name_sealed?: string | null;
  expires_at: string | null;
  created_at: string;

  permission?: Permission;
}

export interface UserProfile {
  id: string;
  email: string;

  display_name: string;
  created_at: string;
  graceDays?: number;
  pendingDeletion?: string | null;
}

export interface SharedFileItem extends FileItem {
  shared_by: string;

  share_expires_at?: string | null;
}

export interface SharedFolderItem extends FolderItem {
  shared_by: string;
  share_expires_at?: string | null;
}

export interface SharedByMeFileItem extends FileItem {
  recipient_count: number;
}

export interface SharedByMeFolderItem extends FolderItem {
  recipient_count: number;
}

export interface ShareItem {
  id: string;
  recipient_id: string;

  label: string;
  expires_at: string | null;
  permission: Permission;
  created_at: string;
}
