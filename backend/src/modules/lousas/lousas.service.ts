import { LousaPreviewMimeSchema, LousaSceneSchema } from '@shared/schemas/lousas.schema';
import { ERROR_CODES } from '@shared/types/api.types';
import {
  LOUSA_MAX_TOTAL_SIZE_BYTES,
  LOUSA_SIGNED_URL_TTL_SECONDS,
  type LousaDto,
  type LousaPreviewMimeType,
  type LousaSignedUrlsDto,
} from '@shared/types/lousas.types';
import type { EdgeLogger } from '../../config/logger';
import type { AppSupabaseClient } from '../../config/supabase';
import { AppError } from '../../errors/AppError';
import {
  mapLousaDto,
  type LousaRelationRow,
  type LousaRow,
} from './lousas.mapper';
import {
  lousasRepository,
  type LousaStoragePaths,
} from './lousas.repository';

export interface LousaMultipartInput {
  sceneFile: File;
  previewFile: File;
}

interface ValidatedLousaPayloads {
  sceneBytes: Uint8Array;
  previewBytes: Uint8Array;
  previewMimeType: LousaPreviewMimeType;
}

const PREVIEW_EXTENSION_BY_MIME: Record<LousaPreviewMimeType, 'webp' | 'png'> = {
  'image/webp': 'webp',
  'image/png': 'png',
};

function buildLousaStoragePaths(
  userId: string,
  lousaId: string,
  previewMimeType: LousaPreviewMimeType
): { sceneStoragePath: string; previewStoragePath: string } {
  const ext = PREVIEW_EXTENSION_BY_MIME[previewMimeType];
  return {
    sceneStoragePath: `${userId}/${lousaId}/scene.json`,
    previewStoragePath: `${userId}/${lousaId}/preview.${ext}`,
  };
}

function normalizeBaseMimeType(rawMime: string): string {
  const [base] = rawMime.split(';');
  return (base ?? '').trim().toLowerCase();
}

function detectPreviewMimeFromMagicBytes(
  bytes: Uint8Array
): LousaPreviewMimeType | null {
  const isPng =
    bytes.byteLength >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  if (isPng) {
    return 'image/png';
  }

  const isWebp =
    bytes.byteLength >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  if (isWebp) {
    return 'image/webp';
  }

  return null;
}

function validatePreviewExtension(
  fileName: string,
  expectedMime: LousaPreviewMimeType
): void {
  const trimmed = fileName.trim().toLowerCase();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot < 0) {
    return;
  }

  const ext = trimmed.slice(lastDot);
  if (ext === '.png' && expectedMime !== 'image/png') {
    throw new AppError(ERROR_CODES.LOUSA_INVALID_PAYLOAD, 400, [
      {
        path: 'preview',
        message: 'A extensão do preview não corresponde ao conteúdo da imagem.',
      },
    ]);
  }
  if (ext === '.webp' && expectedMime !== 'image/webp') {
    throw new AppError(ERROR_CODES.LOUSA_INVALID_PAYLOAD, 400, [
      {
        path: 'preview',
        message: 'A extensão do preview não corresponde ao conteúdo da imagem.',
      },
    ]);
  }
  if (ext !== '.png' && ext !== '.webp') {
    throw new AppError(ERROR_CODES.LOUSA_INVALID_PAYLOAD, 400, [
      {
        path: 'preview',
        message: 'Extensão de preview inválida. Utilize .webp ou .png.',
      },
    ]);
  }
}

async function validateSceneAndPreview(
  input: LousaMultipartInput
): Promise<ValidatedLousaPayloads> {
  const { sceneFile, previewFile } = input;

  if (sceneFile.size <= 0 || previewFile.size <= 0) {
    throw new AppError(ERROR_CODES.LOUSA_INVALID_PAYLOAD, 400, [
      {
        path: sceneFile.size <= 0 ? 'scene' : 'preview',
        message: 'Os arquivos scene e preview não podem estar vazios.',
      },
    ]);
  }

  if (sceneFile.size + previewFile.size > LOUSA_MAX_TOTAL_SIZE_BYTES) {
    throw new AppError(ERROR_CODES.LOUSA_TOO_LARGE, 413);
  }

  const declaredSceneMime = normalizeBaseMimeType(sceneFile.type);
  if (declaredSceneMime.length > 0 && declaredSceneMime !== 'application/json') {
    throw new AppError(ERROR_CODES.LOUSA_INVALID_PAYLOAD, 400, [
      {
        path: 'scene',
        message: 'O arquivo scene deve possuir tipo application/json.',
      },
    ]);
  }

  const sceneBuffer = await sceneFile.arrayBuffer();
  const sceneBytes = new Uint8Array(sceneBuffer);

  const previewBuffer = await previewFile.arrayBuffer();
  const previewBytes = new Uint8Array(previewBuffer);

  if (sceneBytes.byteLength <= 0 || previewBytes.byteLength <= 0) {
    throw new AppError(ERROR_CODES.LOUSA_INVALID_PAYLOAD, 400, [
      {
        path: sceneBytes.byteLength <= 0 ? 'scene' : 'preview',
        message: 'Os arquivos scene e preview não podem estar vazios.',
      },
    ]);
  }

  if (sceneBytes.byteLength + previewBytes.byteLength > LOUSA_MAX_TOTAL_SIZE_BYTES) {
    throw new AppError(ERROR_CODES.LOUSA_TOO_LARGE, 413);
  }

  let decodedSceneText: string;
  try {
    decodedSceneText = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: false,
    }).decode(sceneBytes);
  } catch {
    throw new AppError(ERROR_CODES.LOUSA_INVALID_PAYLOAD, 400, [
      {
        path: 'scene',
        message: 'O arquivo scene não é um texto UTF-8 válido.',
      },
    ]);
  }

  let parsedScene: unknown;
  try {
    parsedScene = JSON.parse(decodedSceneText);
  } catch {
    throw new AppError(ERROR_CODES.LOUSA_INVALID_PAYLOAD, 400, [
      {
        path: 'scene',
        message: 'O arquivo scene contém JSON inválido ou malformado.',
      },
    ]);
  }

  const sceneValidation = LousaSceneSchema.safeParse(parsedScene);
  if (!sceneValidation.success) {
    throw new AppError(ERROR_CODES.LOUSA_INVALID_PAYLOAD, 400, [
      {
        path: 'scene',
        message:
          sceneValidation.error.issues[0]?.message ??
          'A estrutura da cena da lousa é inválida.',
      },
    ]);
  }

  const detectedPreviewMime = detectPreviewMimeFromMagicBytes(previewBytes);
  if (!detectedPreviewMime) {
    throw new AppError(ERROR_CODES.LOUSA_INVALID_PAYLOAD, 400, [
      {
        path: 'preview',
        message:
          'Assinatura binária de pré-visualização inválida. Utilize WebP ou PNG válido.',
      },
    ]);
  }

  const declaredPreviewMime = normalizeBaseMimeType(previewFile.type);
  if (declaredPreviewMime.length > 0) {
    const parsedMime = LousaPreviewMimeSchema.safeParse(declaredPreviewMime);
    if (!parsedMime.success || parsedMime.data !== detectedPreviewMime) {
      throw new AppError(ERROR_CODES.LOUSA_INVALID_PAYLOAD, 400, [
        {
          path: 'preview',
          message:
            'O MIME declarado do preview não corresponde ao formato real da imagem.',
        },
      ]);
    }
  }

  if (previewFile.name) {
    validatePreviewExtension(previewFile.name, detectedPreviewMime);
  }

  return {
    sceneBytes,
    previewBytes,
    previewMimeType: detectedPreviewMime,
  };
}

export class LousasService {
  private async signLousaPair(
    supabase: AppSupabaseClient,
    row: LousaRow,
    logger?: EdgeLogger
  ): Promise<{ previewSignedUrl: string | null; sceneSignedUrl: string | null }> {
    const urlMap = await lousasRepository.createSignedUrlsBatch(
      supabase,
      [row.scene_storage_path, row.preview_storage_path],
      LOUSA_SIGNED_URL_TTL_SECONDS,
      logger
    );

    return {
      sceneSignedUrl: urlMap.get(row.scene_storage_path) ?? null,
      previewSignedUrl: urlMap.get(row.preview_storage_path) ?? null,
    };
  }

  async create(
    supabase: AppSupabaseClient,
    userId: string,
    input: LousaMultipartInput,
    logger?: EdgeLogger
  ): Promise<LousaDto> {
    const { sceneBytes, previewBytes, previewMimeType } =
      await validateSceneAndPreview(input);

    const lousaId = crypto.randomUUID();
    const { sceneStoragePath, previewStoragePath } = buildLousaStoragePaths(
      userId,
      lousaId,
      previewMimeType
    );

    await lousasRepository.uploadFile(
      supabase,
      sceneStoragePath,
      sceneBytes,
      'application/json',
      false
    );

    try {
      await lousasRepository.uploadFile(
        supabase,
        previewStoragePath,
        previewBytes,
        previewMimeType,
        false
      );
    } catch (error) {
      await lousasRepository.removeFilesBestEffort(
        supabase,
        [sceneStoragePath],
        logger
      );
      throw error;
    }

    let inserted: LousaRow;
    try {
      inserted = await lousasRepository.insert(supabase, {
        id: lousaId,
        user_id: userId,
        scene_storage_path: sceneStoragePath,
        preview_storage_path: previewStoragePath,
        preview_mime_type: previewMimeType,
        scene_size_bytes: sceneBytes.byteLength,
        preview_size_bytes: previewBytes.byteLength,
      });
    } catch (error) {
      await lousasRepository.removeFilesBestEffort(
        supabase,
        [sceneStoragePath, previewStoragePath],
        logger
      );
      throw error;
    }

    const signedUrls = await this.signLousaPair(supabase, inserted, logger);
    return mapLousaDto(inserted, signedUrls);
  }

  async getById(
    supabase: AppSupabaseClient,
    userId: string,
    lousaId: string,
    logger?: EdgeLogger
  ): Promise<LousaDto> {
    const row = await lousasRepository.findById(supabase, userId, lousaId);
    if (!row) {
      throw new AppError(ERROR_CODES.LOUSA_NOT_FOUND, 404);
    }

    const signedUrls = await this.signLousaPair(supabase, row, logger);
    return mapLousaDto(row, signedUrls);
  }

  async getUrls(
    supabase: AppSupabaseClient,
    userId: string,
    lousaId: string,
    logger?: EdgeLogger
  ): Promise<LousaSignedUrlsDto> {
    const row = await lousasRepository.findById(supabase, userId, lousaId);
    if (!row) {
      throw new AppError(ERROR_CODES.LOUSA_NOT_FOUND, 404);
    }

    const signedUrls = await this.signLousaPair(supabase, row, logger);
    return {
      previewSignedUrl: signedUrls.previewSignedUrl,
      sceneSignedUrl: signedUrls.sceneSignedUrl,
      expiresInSeconds: LOUSA_SIGNED_URL_TTL_SECONDS,
    };
  }

  async update(
    supabase: AppSupabaseClient,
    userId: string,
    lousaId: string,
    input: LousaMultipartInput,
    logger?: EdgeLogger
  ): Promise<LousaDto> {
    const existing = await lousasRepository.findById(supabase, userId, lousaId);
    if (!existing) {
      throw new AppError(ERROR_CODES.LOUSA_NOT_FOUND, 404);
    }

    const { sceneBytes, previewBytes, previewMimeType } =
      await validateSceneAndPreview(input);

    const { sceneStoragePath, previewStoragePath } = buildLousaStoragePaths(
      userId,
      lousaId,
      previewMimeType
    );

    const previewPathChanged = previewStoragePath !== existing.preview_storage_path;

    await lousasRepository.uploadFile(
      supabase,
      sceneStoragePath,
      sceneBytes,
      'application/json',
      true
    );

    try {
      await lousasRepository.uploadFile(
        supabase,
        previewStoragePath,
        previewBytes,
        previewMimeType,
        true
      );
    } catch (error) {
      if (previewPathChanged) {
        await lousasRepository.removeFilesBestEffort(
          supabase,
          [previewStoragePath],
          logger
        );
      }
      throw error;
    }

    let updated: LousaRow;
    try {
      updated = await lousasRepository.update(supabase, userId, lousaId, {
        scene_storage_path: sceneStoragePath,
        preview_storage_path: previewStoragePath,
        preview_mime_type: previewMimeType,
        scene_size_bytes: sceneBytes.byteLength,
        preview_size_bytes: previewBytes.byteLength,
      });
    } catch (error) {
      if (previewPathChanged) {
        await lousasRepository.removeFilesBestEffort(
          supabase,
          [previewStoragePath],
          logger
        );
      }
      throw error;
    }

    if (previewPathChanged) {
      await lousasRepository.removeFilesBestEffort(
        supabase,
        [existing.preview_storage_path],
        logger
      );
    }

    const signedUrls = await this.signLousaPair(supabase, updated, logger);
    return mapLousaDto(updated, signedUrls);
  }

  async remove(
    supabase: AppSupabaseClient,
    userId: string,
    lousaId: string,
    logger?: EdgeLogger
  ): Promise<{ id: string }> {
    const existing = await lousasRepository.findById(supabase, userId, lousaId);
    if (!existing) {
      throw new AppError(ERROR_CODES.LOUSA_NOT_FOUND, 404);
    }

    const inUse = await lousasRepository.isInUse(supabase, userId, lousaId);
    if (inUse) {
      throw new AppError(ERROR_CODES.LOUSA_IN_USE, 409);
    }

    await lousasRepository.deleteRow(supabase, userId, lousaId);

    await lousasRepository.removeFilesBestEffort(
      supabase,
      [existing.scene_storage_path, existing.preview_storage_path],
      logger
    );

    return { id: lousaId };
  }

  async ensureLousaAvailableForLink(
    supabase: AppSupabaseClient,
    userId: string,
    lousaId: string
  ): Promise<void> {
    const existing = await lousasRepository.findById(supabase, userId, lousaId);
    if (!existing) {
      throw new AppError(ERROR_CODES.LOUSA_NOT_FOUND, 404);
    }

    const inUse = await lousasRepository.isInUse(supabase, userId, lousaId);
    if (inUse) {
      throw new AppError(ERROR_CODES.LOUSA_ALREADY_IN_USE, 409);
    }
  }

  async hydratePreviewSignedUrls(
    supabase: AppSupabaseClient,
    lousas: ReadonlyArray<LousaRelationRow | LousaRow | null | undefined>,
    logger?: EdgeLogger
  ): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>();
    const paths: string[] = [];

    for (const lousa of lousas) {
      if (lousa && lousa.preview_storage_path) {
        paths.push(lousa.preview_storage_path);
      }
    }

    if (paths.length === 0) {
      return result;
    }

    const pathToUrl = await lousasRepository.createSignedUrlsBatch(
      supabase,
      paths,
      LOUSA_SIGNED_URL_TTL_SECONDS,
      logger
    );

    for (const lousa of lousas) {
      if (lousa) {
        result.set(
          lousa.id,
          pathToUrl.get(lousa.preview_storage_path) ?? null
        );
      }
    }

    return result;
  }

  async removeLousaFilesBestEffort(
    supabase: AppSupabaseClient,
    lousas: ReadonlyArray<LousaStoragePaths>,
    logger?: EdgeLogger
  ): Promise<void> {
    const paths = lousas.flatMap((lousa) => [
      lousa.sceneStoragePath,
      lousa.previewStoragePath,
    ]);
    await lousasRepository.removeFilesBestEffort(supabase, paths, logger);
  }
}

export const lousasService = new LousasService();
