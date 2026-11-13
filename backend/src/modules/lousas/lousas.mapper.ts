import type { Database } from '@shared/types/database.types';
import {
  LOUSA_PREVIEW_MIME_TYPES,
  type LousaDto,
  type LousaPreviewMimeType,
  type LousaSummaryDto,
} from '@shared/types/lousas.types';

export type LousaRow = Database['public']['Tables']['lousas']['Row'];

export interface LousaRelationRow {
  id: string;
  scene_storage_path: string;
  preview_storage_path: string;
  preview_mime_type: string;
  scene_size_bytes: number;
  preview_size_bytes: number;
  created_at: string;
  updated_at: string;
}

export const LOUSA_RELATION_SELECT =
  'id, scene_storage_path, preview_storage_path, preview_mime_type, scene_size_bytes, preview_size_bytes, created_at, updated_at';

function normalizePreviewMimeType(mime: string): LousaPreviewMimeType {
  if (mime === LOUSA_PREVIEW_MIME_TYPES[1]) {
    return LOUSA_PREVIEW_MIME_TYPES[1];
  }
  return LOUSA_PREVIEW_MIME_TYPES[0];
}

export function mapLousaSummaryDto(
  row: LousaRelationRow | LousaRow,
  previewSignedUrl: string | null = null
): LousaSummaryDto {
  return {
    id: row.id,
    previewMimeType: normalizePreviewMimeType(row.preview_mime_type),
    sceneSizeBytes: row.scene_size_bytes,
    previewSizeBytes: row.preview_size_bytes,
    totalSizeBytes: row.scene_size_bytes + row.preview_size_bytes,
    previewSignedUrl,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLousaDto(
  row: LousaRow,
  signedUrls: {
    previewSignedUrl: string | null;
    sceneSignedUrl: string | null;
  }
): LousaDto {
  return {
    ...mapLousaSummaryDto(row, signedUrls.previewSignedUrl),
    userId: row.user_id,
    sceneSignedUrl: signedUrls.sceneSignedUrl,
  };
}
