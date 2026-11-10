import {
  ERROR_CODES,
  type ApiErrorResponse,
  type ApiResponse,
  type ApiResponseMeta,
  type ApiSuccessResponse,
  type ErrorCode,
} from '@shared/types/api.types';
import { getEnv } from '@/config/env';
import { ApiClientError, isErrorCode } from '@/lib/errorMessages';
import { getSupabaseClient } from '@/lib/supabase';

export type QueryParamValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryParamValue>;

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /**
   * 'required' (padrão): exige sessão ativa e injeta Authorization Bearer.
   * 'optional': injeta token se houver sessão.
   * 'none': não consulta sessão nem envia token (ex.: /health).
   */
  auth?: 'required' | 'optional' | 'none';
}

export interface PaginatedResult<T> {
  data: T;
  meta: ApiResponseMeta;
}

function mapStatusToErrorCode(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400:
      return ERROR_CODES.VALIDATION_ERROR;
    case 401:
      return ERROR_CODES.UNAUTHORIZED;
    case 403:
      return ERROR_CODES.FORBIDDEN;
    case 404:
      return ERROR_CODES.NOT_FOUND;
    case 409:
      return ERROR_CODES.CONFLICT;
    case 429:
      return ERROR_CODES.RATE_LIMIT_EXCEEDED;
    default:
      return ERROR_CODES.INTERNAL_SERVER_ERROR;
  }
}

function buildApiUrl(path: string, query?: QueryParams): string {
  const { VITE_API_URL } = getEnv();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${VITE_API_URL}${normalizedPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

function isApiErrorPayload(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    value.success === false &&
    'code' in value &&
    isErrorCode(value.code)
  );
}

function isApiSuccessPayload<T>(value: unknown): value is ApiSuccessResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    value.success === true &&
    'data' in value
  );
}

async function resolveAccessToken(
  authMode: 'required' | 'optional' | 'none'
): Promise<string | null> {
  if (authMode === 'none') {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    if (authMode === 'required') {
      throw new ApiClientError({
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED,
      });
    }
    return null;
  }

  return data.session.access_token;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiSuccessResponse<T>> {
  const {
    method = 'GET',
    body,
    query,
    headers = {},
    signal,
    auth = 'required',
  } = options;

  const accessToken = await resolveAccessToken(auth);
  const requestHeaders = new Headers(headers);

  if (accessToken) {
    requestHeaders.set('Authorization', `Bearer ${accessToken}`);
  }

  let preparedBody: BodyInit | undefined;
  if (body instanceof FormData) {
    // Deixa o navegador definir o boundary multipart/form-data automaticamente.
    requestHeaders.delete('Content-Type');
    preparedBody = body;
  } else if (body !== undefined) {
    if (!requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json');
    }
    preparedBody = JSON.stringify(body);
  }

  const response = await fetch(buildApiUrl(path, query), {
    method,
    headers: requestHeaders,
    body: preparedBody,
    signal,
  });

  const rawText = await response.text();
  let parsedPayload: ApiResponse<T> | unknown = null;

  if (rawText.trim().length > 0) {
    try {
      parsedPayload = JSON.parse(rawText) as unknown;
    } catch {
      throw new ApiClientError({
        statusCode: response.status,
        code: mapStatusToErrorCode(response.status),
      });
    }
  }

  if (isApiErrorPayload(parsedPayload)) {
    throw new ApiClientError({
      statusCode: response.status,
      code: parsedPayload.code,
      details: parsedPayload.details,
    });
  }

  if (!response.ok) {
    throw new ApiClientError({
      statusCode: response.status,
      code: mapStatusToErrorCode(response.status),
    });
  }

  if (!isApiSuccessPayload<T>(parsedPayload)) {
    throw new ApiClientError({
      statusCode: response.status || 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  return parsedPayload;
}

export const apiClient = {
  async get<T>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>
  ): Promise<T> {
    const response = await apiRequest<T>(path, { ...options, method: 'GET' });
    return response.data;
  },

  async getPaginated<T>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>
  ): Promise<PaginatedResult<T>> {
    const response = await apiRequest<T>(path, { ...options, method: 'GET' });
    return {
      data: response.data,
      meta: response.meta ?? {},
    };
  },

  async post<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>
  ): Promise<T> {
    const response = await apiRequest<T>(path, {
      ...options,
      method: 'POST',
      body,
    });
    return response.data;
  },

  async patch<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>
  ): Promise<T> {
    const response = await apiRequest<T>(path, {
      ...options,
      method: 'PATCH',
      body,
    });
    return response.data;
  },

  async put<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>
  ): Promise<T> {
    const response = await apiRequest<T>(path, {
      ...options,
      method: 'PUT',
      body,
    });
    return response.data;
  },

  async delete<T>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>
  ): Promise<T> {
    const response = await apiRequest<T>(path, { ...options, method: 'DELETE' });
    return response.data;
  },
};
