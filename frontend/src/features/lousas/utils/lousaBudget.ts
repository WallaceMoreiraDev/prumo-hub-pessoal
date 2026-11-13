import { LousaSceneSchema } from '@shared/schemas/lousas.schema';
import {
  LOUSA_MAX_TOTAL_SIZE_BYTES,
  LOUSA_PREVIEW_MIME_TYPES,
  type LousaPreviewMimeType,
} from '@shared/types/lousas.types';

const utf8Encoder = new TextEncoder();

export const LOUSA_RASTER_MAX_DIMENSION_PX = 1600;
export const LOUSA_RASTER_COMPRESS_QUALITY = 0.82;

const COMPRESSIBLE_RASTER_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/bmp',
]);

export interface LousaBudgetEvaluation {
  sceneBytes: number;
  previewBytes: number;
  totalBytes: number;
  maxBytes: number;
  remainingBytes: number;
  usageRatio: number;
  isWithinLimit: boolean;
}

export function measureUtf8ByteLength(value: string): number {
  if (!value) {
    return 0;
  }
  return utf8Encoder.encode(value).byteLength;
}

export function calculateLousaTotalBytes(
  sceneJson: string,
  previewByteLength: number
): number {
  const safePreviewBytes =
    Number.isFinite(previewByteLength) && previewByteLength > 0
      ? Math.floor(previewByteLength)
      : 0;
  return measureUtf8ByteLength(sceneJson) + safePreviewBytes;
}

export function evaluateLousaBudget(
  sceneJson: string,
  previewByteLength: number,
  maxBytes: number = LOUSA_MAX_TOTAL_SIZE_BYTES
): LousaBudgetEvaluation {
  const sceneBytes = measureUtf8ByteLength(sceneJson);
  const previewBytes =
    Number.isFinite(previewByteLength) && previewByteLength > 0
      ? Math.floor(previewByteLength)
      : 0;
  const totalBytes = sceneBytes + previewBytes;
  const remainingBytes = maxBytes - totalBytes;
  const usageRatio = maxBytes > 0 ? totalBytes / maxBytes : 1;

  return {
    sceneBytes,
    previewBytes,
    totalBytes,
    maxBytes,
    remainingBytes,
    usageRatio,
    isWithinLimit: totalBytes > 0 && totalBytes <= maxBytes,
  };
}

export function isWithinLousaBudget(
  totalBytes: number,
  maxBytes: number = LOUSA_MAX_TOTAL_SIZE_BYTES
): boolean {
  return Number.isFinite(totalBytes) && totalBytes > 0 && totalBytes <= maxBytes;
}

export function formatBytesLabel(bytes: number): string {
  const safeBytes = Number.isFinite(bytes) && bytes > 0 ? Math.floor(bytes) : 0;

  if (safeBytes < 1024) {
    return `${safeBytes} B`;
  }

  if (safeBytes < 1024 * 1024) {
    return `${(safeBytes / 1024).toFixed(1).replace('.', ',')} KiB`;
  }

  return `${(safeBytes / (1024 * 1024)).toFixed(2).replace('.', ',')} MiB`;
}

export function isSupportedLousaPreviewMime(
  mimeType: string
): mimeType is LousaPreviewMimeType {
  return (LOUSA_PREVIEW_MIME_TYPES as readonly string[]).includes(mimeType);
}

export interface ValidatedLousaScene {
  type?: 'excalidraw';
  elements: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

export function parseValidatedLousaScene(raw: unknown): ValidatedLousaScene {
  const parsed = LousaSceneSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('Estrutura de cena da lousa inválida.');
  }

  const record = parsed.data as Record<string, unknown>;
  return {
    type: parsed.data.type,
    elements: parsed.data.elements,
    appState:
      record.appState &&
      typeof record.appState === 'object' &&
      !Array.isArray(record.appState)
        ? (record.appState as Record<string, unknown>)
        : undefined,
    files:
      record.files &&
      typeof record.files === 'object' &&
      !Array.isArray(record.files)
        ? (record.files as Record<string, unknown>)
        : undefined,
  };
}

export function estimateDataUrlByteSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) {
    return measureUtf8ByteLength(dataUrl);
  }

  const header = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  if (header.includes(';base64')) {
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  }

  return measureUtf8ByteLength(payload);
}

export interface CompressedRasterImageResult {
  dataUrl: string;
  mimeType: string;
  didCompress: boolean;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao decodificar imagem raster.'));
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao converter blob comprimido para DataURL.'));
      }
    };
    reader.onerror = () => reject(new Error('Falha ao ler blob comprimido.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Redimensiona imagens raster coladas/inseridas na lousa para até 1600px de lado maior
 * e recomprime em WebP (com fallback JPEG), preservando SVG intacto e mantendo o original
 * caso a recompressão não gere redução real.
 */
export async function compressRasterImageDataUrl(
  dataUrl: string,
  mimeType: string
): Promise<CompressedRasterImageResult> {
  if (
    typeof document === 'undefined' ||
    !COMPRESSIBLE_RASTER_MIME_TYPES.has(mimeType.toLowerCase())
  ) {
    return { dataUrl, mimeType, didCompress: false };
  }

  try {
    const img = await loadImageElement(dataUrl);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    if (width <= 0 || height <= 0) {
      return { dataUrl, mimeType, didCompress: false };
    }

    const scale = Math.min(
      1,
      LOUSA_RASTER_MAX_DIMENSION_PX / Math.max(width, height)
    );
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { dataUrl, mimeType, didCompress: false };
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const webpBlob = await canvasToBlob(
      canvas,
      'image/webp',
      LOUSA_RASTER_COMPRESS_QUALITY
    );
    const targetBlob =
      webpBlob && webpBlob.type === 'image/webp'
        ? webpBlob
        : await canvasToBlob(
            canvas,
            'image/jpeg',
            LOUSA_RASTER_COMPRESS_QUALITY
          );

    if (!targetBlob) {
      return { dataUrl, mimeType, didCompress: false };
    }

    const compressedDataUrl = await blobToDataUrl(targetBlob);
    const originalSize = estimateDataUrlByteSize(dataUrl);
    const compressedSize = estimateDataUrlByteSize(compressedDataUrl);

    if (compressedSize >= originalSize && scale === 1) {
      return { dataUrl, mimeType, didCompress: false };
    }

    return {
      dataUrl: compressedDataUrl,
      mimeType: targetBlob.type || 'image/webp',
      didCompress: true,
    };
  } catch {
    return { dataUrl, mimeType, didCompress: false };
  }
}
