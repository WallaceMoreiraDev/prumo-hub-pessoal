import type { MiddlewareHandler } from 'hono';
import type { z, ZodType } from 'zod';
import {
  ERROR_CODES,
  type ApiValidationErrorDetail,
} from '@shared/types/api.types';
import { AppError } from '../errors/AppError';
import type { AppBindings, AppVariables } from '../types/hono.types';

function formatZodIssues(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
  fallbackPath: string
): ApiValidationErrorDetail[] {
  return issues.map((issue) => ({
    path:
      issue.path.length > 0
        ? issue.path.map((segment) => String(segment)).join('.')
        : fallbackPath,
    message: issue.message,
  }));
}

export function validateBody<TSchema extends ZodType>(
  schema: TSchema
): MiddlewareHandler<{
  Bindings: AppBindings;
  Variables: AppVariables & { validBody: z.output<TSchema> };
}> {
  return async (c, next) => {
    let rawBody: unknown;

    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.INVALID_JSON, 400, [
        {
          path: 'body',
          message: 'Corpo da requisição JSON inválido ou malformado.',
        },
      ]);
    }

    const result = await schema.safeParseAsync(rawBody);
    if (!result.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        formatZodIssues(result.error.issues, 'body')
      );
    }

    c.set('validBody', result.data);
    await next();
  };
}

export function validateParam<TSchema extends ZodType>(
  schema: TSchema
): MiddlewareHandler<{
  Bindings: AppBindings;
  Variables: AppVariables & { validParams: z.output<TSchema> };
}> {
  return async (c, next) => {
    const rawParams = c.req.param();
    const result = await schema.safeParseAsync(rawParams);

    if (!result.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        formatZodIssues(result.error.issues, 'params')
      );
    }

    c.set('validParams', result.data);
    await next();
  };
}

export function validateQuery<TSchema extends ZodType>(
  schema: TSchema
): MiddlewareHandler<{
  Bindings: AppBindings;
  Variables: AppVariables & { validQuery: z.output<TSchema> };
}> {
  return async (c, next) => {
    const rawQuery = c.req.query();
    const result = await schema.safeParseAsync(rawQuery);

    if (!result.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        formatZodIssues(result.error.issues, 'query')
      );
    }

    c.set('validQuery', result.data);
    await next();
  };
}
