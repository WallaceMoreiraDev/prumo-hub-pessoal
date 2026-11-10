import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ApiResponseMeta, ApiSuccessResponse } from '@shared/types/api.types';
import type { AppEnv } from '../types/hono.types';

export function jsonSuccess<T>(
  c: Context<AppEnv>,
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
