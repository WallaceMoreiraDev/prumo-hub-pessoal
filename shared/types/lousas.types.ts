export const LOUSA_MAX_TOTAL_SIZE_BYTES = 3 * 1024 * 1024;

export const LOUSA_SIGNED_URL_TTL_SECONDS = 3600;

export const LOUSA_PREVIEW_MIME_TYPES = ['image/webp', 'image/png'] as const;

export type LousaPreviewMimeType = (typeof LOUSA_PREVIEW_MIME_TYPES)[number];

export interface LousaSummaryDto {
  id: string;
  previewMimeType: LousaPreviewMimeType;
  sceneSizeBytes: number;
  previewSizeBytes: number;
  totalSizeBytes: number;
  previewSignedUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LousaDto extends LousaSummaryDto {
  userId: string;
  sceneSignedUrl: string | null;
}

export interface LousaSignedUrlsDto {
  previewSignedUrl: string | null;
  sceneSignedUrl: string | null;
  expiresInSeconds: number;
}
