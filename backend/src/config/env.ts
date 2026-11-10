import { z } from 'zod';
import { ERROR_CODES } from '@shared/types/api.types';
import { AppError } from '../errors/AppError';
import { edgeLogger } from './logger';

export const envSchema = z.object({
  SUPABASE_URL: z
    .string({ error: 'SUPABASE_URL é obrigatória.' })
    .trim()
    .pipe(
      z.url({
        protocol: /^https?$/,
        error: 'SUPABASE_URL deve ser uma URL válida iniciada com http:// ou https://.',
      })
    ),
  SUPABASE_ANON_KEY: z
    .string({ error: 'SUPABASE_ANON_KEY é obrigatória.' })
    .trim()
    .min(1, { error: 'SUPABASE_ANON_KEY não pode estar vazia.' }),
  CORS_ORIGIN: z
    .string({ error: 'CORS_ORIGIN é obrigatório.' })
    .trim()
    .min(1, { error: 'CORS_ORIGIN não pode estar vazio.' })
    .refine(
      (value) => !value.split(',').some((origin) => origin.trim() === '*'),
      {
        error:
          'CORS_ORIGIN não pode conter curinga "*". Informe origens explícitas.',
      }
    ),
  ENVIRONMENT: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export type EnvValues = z.infer<typeof envSchema>;

export interface ValidatedEnv extends EnvValues {
  allowedCorsOrigins: readonly string[];
}

export function validateEnv(rawEnv: unknown): ValidatedEnv {
  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.') || 'env',
      message: issue.message,
    }));

    edgeLogger.fatal('Falha na validação das variáveis de ambiente do Worker', {
      code: 'ENV_VALIDATION_ERROR',
      details,
    });

    throw new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, 500);
  }

  const allowedCorsOrigins = parsed.data.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (allowedCorsOrigins.length === 0) {
    edgeLogger.fatal('CORS_ORIGIN não possui origens válidas configuradas', {
      code: 'ENV_VALIDATION_ERROR',
    });

    throw new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, 500);
  }

  return {
    ...parsed.data,
    allowedCorsOrigins,
  };
}
