import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import {
  ERROR_CODES,
  type ApiErrorResponse,
  type ApiValidationErrorDetail,
} from '@shared/types/api.types';
import { edgeLogger } from '../config/logger';
import type { AppEnv } from '../types/hono.types';
import { AppError } from './AppError';

interface ZodIssueLike {
  path: ReadonlyArray<PropertyKey>;
  message: string;
}

interface ZodErrorLike extends Error {
  issues: ReadonlyArray<ZodIssueLike>;
}

function isZodErrorLike(error: unknown): error is ZodErrorLike {
  if (error instanceof ZodError) {
    return true;
  }

  if (!(error instanceof Error) || error.name !== 'ZodError') {
    return false;
  }

  const maybeIssues = (error as { issues?: unknown }).issues;
  return Array.isArray(maybeIssues);
}

function mapZodIssues(
  issues: ReadonlyArray<ZodIssueLike>
): ApiValidationErrorDetail[] {
  return issues.map((issue) => ({
    path:
      issue.path.length > 0
        ? issue.path.map((segment) => String(segment)).join('.')
        : 'root',
    message: issue.message,
  }));
}

function toContentfulStatus(statusCode: number): ContentfulStatusCode {
  if (
    statusCode >= 200 &&
    statusCode <= 599 &&
    statusCode !== 204 &&
    statusCode !== 205 &&
    statusCode !== 304
  ) {
    return statusCode as ContentfulStatusCode;
  }
  return 500;
}

export function notFoundHandler(c: Context<AppEnv>): Response {
  const payload: ApiErrorResponse = {
    success: false,
    code: ERROR_CODES.NOT_FOUND,
  };
  return c.json(payload, 404);
}

export function errorHandler(err: Error, c: Context<AppEnv>): Response {
  const log = c.get('logger') ?? edgeLogger;
  const userId = c.get('user')?.id;

  if (err instanceof AppError) {
    const logMeta: Record<string, unknown> = {
      code: err.code,
      statusCode: err.statusCode,
      method: c.req.method,
      path: c.req.path,
      userId,
      ...(err.details ? { details: err.details } : {}),
    };

    if (err.statusCode >= 500) {
      log.error('Operational server error', logMeta);
    } else {
      log.warn('Operational client error', logMeta);
    }

    const payload: ApiErrorResponse = {
      success: false,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    };
    return c.json(payload, toContentfulStatus(err.statusCode));
  }

  if (isZodErrorLike(err)) {
    const details = mapZodIssues(err.issues);

    log.warn('Validation error', {
      code: ERROR_CODES.VALIDATION_ERROR,
      method: c.req.method,
      path: c.req.path,
      userId,
      details,
    });

    const payload: ApiErrorResponse = {
      success: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      details,
    };
    return c.json(payload, 400);
  }

  if (err instanceof HTTPException) {
    const status = toContentfulStatus(err.status);

    if (status === 400) {
      log.warn('HTTP 400 exception', {
        method: c.req.method,
        path: c.req.path,
        userId,
      });
      return c.json(
        {
          success: false,
          code: ERROR_CODES.VALIDATION_ERROR,
        } satisfies ApiErrorResponse,
        400
      );
    }

    if (status === 401) {
      return c.json(
        {
          success: false,
          code: ERROR_CODES.UNAUTHORIZED,
        } satisfies ApiErrorResponse,
        401
      );
    }

    if (status === 403) {
      return c.json(
        {
          success: false,
          code: ERROR_CODES.FORBIDDEN,
        } satisfies ApiErrorResponse,
        403
      );
    }

    if (status === 404) {
      return c.json(
        {
          success: false,
          code: ERROR_CODES.NOT_FOUND,
        } satisfies ApiErrorResponse,
        404
      );
    }
  }

  const env = c.get('env');
  const isProduction = env?.ENVIRONMENT === 'production';

  log.error('Unhandled internal server error', {
    method: c.req.method,
    path: c.req.path,
    userId,
    errorName: err.name,
    errorMessage: err.message,
    ...(!isProduction && err.stack ? { stack: err.stack } : {}),
  });

  const payload: ApiErrorResponse = {
    success: false,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
  };
  return c.json(payload, 500);
}
