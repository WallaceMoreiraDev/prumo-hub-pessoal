import type { Context, Env } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type {
  ApiResponseMeta,
  ApiSuccessResponse,
  PaginationMeta,
} from '@shared/types/api.types';
import type { AppEnv } from '../types/hono.types';

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export function jsonSuccess<T, TEnv extends Env = AppEnv>(
  c: Context<TEnv>,
  data: T,
  status: ContentfulStatusCode = 200,
  meta?: ApiResponseMeta
): Response {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(meta !== undefined ? { meta } : {}),
  };

  return c.json(payload, status);
}
