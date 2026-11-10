import { ERROR_CODES, type ErrorCode } from '@shared/types/api.types';
import { AppError } from '../errors/AppError';

export interface SupabasePostgrestErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

const RPC_MESSAGE_TO_ERROR: Readonly<
  Record<string, { code: ErrorCode; statusCode: number }>
> = {
  UNAUTHORIZED: { code: ERROR_CODES.UNAUTHORIZED, statusCode: 401 },
  INVALID_RESULTADO: { code: ERROR_CODES.INVALID_RESULTADO, statusCode: 400 },
  INVALID_REVIEW_MODE: { code: ERROR_CODES.INVALID_REVIEW_MODE, statusCode: 400 },
  TEMAS_REQUIRED: { code: ERROR_CODES.TEMAS_REQUIRED, statusCode: 400 },
  SIMULADO_NOT_FOUND: { code: ERROR_CODES.SIMULADO_NOT_FOUND, statusCode: 404 },
  SIMULADO_QUESTAO_NOT_FOUND: {
    code: ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND,
    statusCode: 404,
  },
  SIMULADO_PENSAMENTO_NOT_FOUND: {
    code: ERROR_CODES.SIMULADO_PENSAMENTO_NOT_FOUND,
    statusCode: 404,
  },
  TEMA_NOT_FOUND: { code: ERROR_CODES.TEMA_NOT_FOUND, statusCode: 404 },
  REFLEXAO_NOT_FOUND: { code: ERROR_CODES.REFLEXAO_NOT_FOUND, statusCode: 404 },
  CADERNO_ERRO_NOT_FOUND: {
    code: ERROR_CODES.CADERNO_ERRO_NOT_FOUND,
    statusCode: 404,
  },
};

function resolveForeignKeyNotFoundCode(
  combinedText: string,
  fallbackNotFoundCode: ErrorCode
): ErrorCode {
  if (combinedText.includes('simulado_questao')) {
    return ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND;
  }
  if (combinedText.includes('simulado')) {
    return ERROR_CODES.SIMULADO_NOT_FOUND;
  }
  if (combinedText.includes('caderno_erro')) {
    return ERROR_CODES.CADERNO_ERRO_NOT_FOUND;
  }
  if (combinedText.includes('reflexao')) {
    return ERROR_CODES.REFLEXAO_NOT_FOUND;
  }
  if (combinedText.includes('tema')) {
    return ERROR_CODES.TEMA_NOT_FOUND;
  }
  return fallbackNotFoundCode;
}

export function mapSupabaseError(
  error: SupabasePostgrestErrorLike,
  fallbackNotFoundCode: ErrorCode = ERROR_CODES.NOT_FOUND
): AppError {
  const code = error.code ?? '';
  const message = (error.message ?? '').trim();
  const details = (error.details ?? '').trim();
  const combined = `${message} ${details}`.toLowerCase();

  const directMatch = RPC_MESSAGE_TO_ERROR[message];
  if (directMatch) {
    return new AppError(directMatch.code, directMatch.statusCode);
  }

  for (const [rpcKey, mapped] of Object.entries(RPC_MESSAGE_TO_ERROR)) {
    if (message.includes(rpcKey)) {
      return new AppError(mapped.code, mapped.statusCode);
    }
  }

  switch (code) {
    case '42501': {
      if (combined.includes('unauthorized')) {
        return new AppError(ERROR_CODES.UNAUTHORIZED, 401);
      }
      return new AppError(ERROR_CODES.FORBIDDEN, 403);
    }

    case 'P0002':
    case 'PGRST116': {
      return new AppError(fallbackNotFoundCode, 404);
    }

    case '23505': {
      if (
        combined.includes('idx_temas_user_lower_nome_unique') ||
        combined.includes('temas')
      ) {
        return new AppError(ERROR_CODES.TEMA_ALREADY_EXISTS, 409);
      }
      return new AppError(ERROR_CODES.CONFLICT, 409);
    }

    case '23514': {
      if (
        combined.includes('temas_nome_sem_hashtag') ||
        combined.includes('temas_nome_not_blank')
      ) {
        return new AppError(ERROR_CODES.TEMA_INVALID_NAME, 400);
      }
      return new AppError(ERROR_CODES.VALIDATION_ERROR, 400);
    }

    case '22023':
    case '22P02': {
      if (combined.includes('review_mode')) {
        return new AppError(ERROR_CODES.INVALID_REVIEW_MODE, 400);
      }
      if (combined.includes('resultado')) {
        return new AppError(ERROR_CODES.INVALID_RESULTADO, 400);
      }
      return new AppError(ERROR_CODES.VALIDATION_ERROR, 400);
    }

    case '23503': {
      return new AppError(
        resolveForeignKeyNotFoundCode(combined, fallbackNotFoundCode),
        404
      );
    }

    default: {
      return new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, 500);
    }
  }
}

export function throwIfSupabaseError(
  error: SupabasePostgrestErrorLike | null,
  fallbackNotFoundCode: ErrorCode = ERROR_CODES.NOT_FOUND
): void {
  if (error !== null) {
    throw mapSupabaseError(error, fallbackNotFoundCode);
  }
}
