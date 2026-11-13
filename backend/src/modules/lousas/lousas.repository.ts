import { ERROR_CODES } from '@shared/types/api.types';
import type { Database } from '@shared/types/database.types';
import type { EdgeLogger } from '../../config/logger';
import type { AppSupabaseClient } from '../../config/supabase';
import { AppError } from '../../errors/AppError';
import {
  isStorageNotFoundError,
  mapSupabaseError,
  mapSupabaseStorageError,
} from '../../utils/supabaseErrorMapper';
import type { LousaRow } from './lousas.mapper';

export const LOUSA_STORAGE_BUCKET = 'lousas-private';
const SIGNED_URL_BATCH_LIMIT = 50;

export type LousaDbInsert = Database['public']['Tables']['lousas']['Insert'];
export type LousaDbUpdate = Database['public']['Tables']['lousas']['Update'];

export interface LousaStoragePaths {
  id: string;
  sceneStoragePath: string;
  previewStoragePath: string;
}

export class LousasRepository {
  async findById(
    supabase: AppSupabaseClient,
    userId: string,
    lousaId: string
  ): Promise<LousaRow | null> {
    const { data, error } = await supabase
      .from('lousas')
      .select('*')
      .eq('id', lousaId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw mapSupabaseError(error, ERROR_CODES.LOUSA_NOT_FOUND);
    }

    return data;
  }

  async insert(
    supabase: AppSupabaseClient,
    payload: LousaDbInsert
  ): Promise<LousaRow> {
    const { data, error } = await supabase
      .from('lousas')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      throw mapSupabaseError(error ?? {}, ERROR_CODES.LOUSA_NOT_FOUND);
    }

    return data;
  }

  async update(
    supabase: AppSupabaseClient,
    userId: string,
    lousaId: string,
    payload: LousaDbUpdate
  ): Promise<LousaRow> {
    const { data, error } = await supabase
      .from('lousas')
      .update(payload)
      .eq('id', lousaId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapSupabaseError(error, ERROR_CODES.LOUSA_NOT_FOUND);
    }

    if (!data) {
      throw new AppError(ERROR_CODES.LOUSA_NOT_FOUND, 404);
    }

    return data;
  }

  async deleteRow(
    supabase: AppSupabaseClient,
    userId: string,
    lousaId: string
  ): Promise<LousaRow> {
    const { data, error } = await supabase
      .from('lousas')
      .delete()
      .eq('id', lousaId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw mapSupabaseError(error, ERROR_CODES.LOUSA_NOT_FOUND);
    }

    if (!data) {
      throw new AppError(ERROR_CODES.LOUSA_NOT_FOUND, 404);
    }

    return data;
  }

  async isInUse(
    supabase: AppSupabaseClient,
    userId: string,
    lousaId: string
  ): Promise<boolean> {
    const [reflexaoUsage, cadernoErroUsage] = await Promise.all([
      supabase
        .from('reflexoes')
        .select('id')
        .eq('user_id', userId)
        .eq('lousa_id', lousaId)
        .maybeSingle(),
      supabase
        .from('caderno_erros')
        .select('id')
        .eq('user_id', userId)
        .eq('lousa_id', lousaId)
        .maybeSingle(),
    ]);

    if (reflexaoUsage.error) {
      throw mapSupabaseError(reflexaoUsage.error);
    }
    if (cadernoErroUsage.error) {
      throw mapSupabaseError(cadernoErroUsage.error);
    }

    return reflexaoUsage.data !== null || cadernoErroUsage.data !== null;
  }

  async uploadFile(
    supabase: AppSupabaseClient,
    storagePath: string,
    bytes: Uint8Array,
    contentType: string,
    upsert: boolean
  ): Promise<void> {
    const { error } = await supabase.storage
      .from(LOUSA_STORAGE_BUCKET)
      .upload(storagePath, bytes, {
        contentType,
        cacheControl: '3600',
        upsert,
      });

    if (error) {
      throw mapSupabaseStorageError(error, 'lousa');
    }
  }

  async createSignedUrlsBatch(
    supabase: AppSupabaseClient,
    paths: ReadonlyArray<string>,
    expiresInSeconds: number,
    logger?: EdgeLogger
  ): Promise<Map<string, string | null>> {
    const resultMap = new Map<string, string | null>();
    const uniquePaths = Array.from(
      new Set(paths.filter((path) => path.trim().length > 0))
    );

    if (uniquePaths.length === 0) {
      return resultMap;
    }

    for (let i = 0; i < uniquePaths.length; i += SIGNED_URL_BATCH_LIMIT) {
      const chunk = uniquePaths.slice(i, i + SIGNED_URL_BATCH_LIMIT);
      const { data, error } = await supabase.storage
        .from(LOUSA_STORAGE_BUCKET)
        .createSignedUrls(chunk, expiresInSeconds);

      if (error) {
        if (isStorageNotFoundError(error)) {
          for (const path of chunk) {
            resultMap.set(path, null);
          }
          logger?.warn('Lousa storage objects not found during signed URL batch', {
            pathsCount: chunk.length,
          });
          continue;
        }
        throw mapSupabaseStorageError(error, 'lousa');
      }

      const returnedPaths = new Set<string>();
      for (const item of data ?? []) {
        if (!item.path) {
          continue;
        }
        returnedPaths.add(item.path);
        const resolvedUrl = item.signedUrl ?? item.signedURL ?? null;
        if (item.error || !resolvedUrl) {
          resultMap.set(item.path, null);
          logger?.warn('Failed to sign individual lousa storage object', {
            path: item.path,
            reason: item.error ?? 'missing_signed_url',
          });
        } else {
          resultMap.set(item.path, resolvedUrl);
        }
      }

      for (const path of chunk) {
        if (!returnedPaths.has(path)) {
          resultMap.set(path, null);
        }
      }
    }

    return resultMap;
  }

  async removeFilesBestEffort(
    supabase: AppSupabaseClient,
    paths: ReadonlyArray<string>,
    logger?: EdgeLogger
  ): Promise<void> {
    const uniquePaths = Array.from(
      new Set(paths.filter((path) => path.trim().length > 0))
    );

    if (uniquePaths.length === 0) {
      return;
    }

    try {
      const { error } = await supabase.storage
        .from(LOUSA_STORAGE_BUCKET)
        .remove(uniquePaths);

      if (error && !isStorageNotFoundError(error)) {
        logger?.warn('Best-effort lousa storage removal returned error', {
          pathsCount: uniquePaths.length,
          message: error.message,
        });
      }
    } catch (error) {
      logger?.warn('Best-effort lousa storage removal threw exception', {
        pathsCount: uniquePaths.length,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const lousasRepository = new LousasRepository();
