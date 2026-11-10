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
  if (
    combinedText.includes('table "temas"') ||
    combinedText.includes('_tema_id_fkey') ||
    combinedText.includes('_tema_conectado_id_fkey') ||
    combinedText.includes('_tema_principal_id_fkey')
  ) {
    return ERROR_CODES.TEMA_NOT_FOUND;
  }
  if (
    combinedText.includes('table "simulado_questoes"') ||
    combinedText.includes('simulado_questao')
  ) {
    return ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND;
  }
  if (
    combinedText.includes('table "simulados"') ||
    combinedText.includes('simulado')
  ) {
    return ERROR_CODES.SIMULADO_NOT_FOUND;
  }
  if (
    combinedText.includes('table "caderno_erros"') ||
    combinedText.includes('caderno_erro')
  ) {
    return ERROR_CODES.CADERNO_ERRO_NOT_FOUND;
  }
  if (
    combinedText.includes('table "reflexoes"') ||
    combinedText.includes('reflexao')
  ) {
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

    case '23502': {
      return new AppError(ERROR_CODES.VALIDATION_ERROR, 400);
    }

    case '23514': {
      if (
        combined.includes('temas_nome_sem_hashtag') ||
        combined.includes('temas_nome_not_blank')
      ) {
        return new AppError(ERROR_CODES.TEMA_INVALID_NAME, 400);
      }
      if (combined.includes('caderno_erros_titulo_not_blank')) {
        return new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
          {
            path: 'titulo',
            message: 'O título da questão não pode estar vazio.',
          },
        ]);
      }
      if (combined.includes('caderno_erros_origem_payload_check')) {
        return new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
          {
            path: 'origem',
            message:
              'Os campos informados são incompatíveis com a origem do erro.',
          },
        ]);
      }
      if (combined.includes('caderno_erros_review_consistency')) {
        return new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
          {
            path: 'reviewMode',
            message: 'Inconsistência nos dados de revisão do registro.',
          },
        ]);
      }
      if (combined.includes('simulados_titulo_not_blank')) {
        return new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
          {
            path: 'titulo',
            message: 'O título do simulado não pode estar vazio.',
          },
        ]);
      }
      if (combined.includes('simulados_duracao_positive')) {
        return new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
          {
            path: 'duracaoConfiguradaSegundos',
            message: 'A duração do simulado deve ser maior que zero.',
          },
        ]);
      }
      if (combined.includes('simulados_tempo_gasto_non_negative')) {
        return new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
          {
            path: 'tempoGastoSegundos',
            message: 'O tempo gasto não pode ser negativo.',
          },
        ]);
      }
      if (combined.includes('simulados_timestamps_order')) {
        return new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
          {
            path: 'finishedAt',
            message:
              'A data de finalização não pode ser anterior ao início do simulado.',
          },
        ]);
      }
      if (combined.includes('simulado_questoes_numero_not_blank')) {
        return new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
          {
            path: 'numeroQuestao',
            message: 'O número/código da questão não pode estar vazio.',
          },
        ]);
      }
      if (combined.includes('simulado_questoes_titulo_not_blank')) {
        return new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
          {
            path: 'tituloQuestao',
            message: 'O título da questão não pode estar vazio.',
          },
        ]);
      }
      if (combined.includes('simulado_questoes_ordem_non_negative')) {
        return new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
          {
            path: 'ordem',
            message: 'A ordem da questão não pode ser negativa.',
          },
        ]);
      }
      if (combined.includes('simulado_questoes_acertei_sem_observacao')) {
        return new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
          {
            path: 'observacaoPosRevisao',
            message:
              'A observação de pós-revisão não é permitida quando o resultado é ACERTEI.',
          },
        ]);
      }
      if (combined.includes('simulado_pensamentos_descricao_not_blank')) {
        return new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
          {
            path: 'descricao',
            message: 'A descrição do pensamento não pode estar vazia.',
          },
        ]);
      }
      if (combined.includes('simulado_pensamentos_tempo_non_negative')) {
        return new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
          {
            path: 'tempoDecorridoSegundos',
            message: 'O tempo decorrido não pode ser negativo.',
          },
        ]);
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

export interface SupabaseStorageErrorLike {
  message?: string;
  status?: number | undefined;
  statusCode?: string | undefined;
  code?: string | undefined;
}

export function isStorageNotFoundError(error: SupabaseStorageErrorLike): boolean {
  const status = error.status;
  const statusCode = (error.statusCode ?? '').trim();
  const code = (error.code ?? '').trim().toLowerCase();
  const message = (error.message ?? '').toLowerCase();

  return (
    status === 404 ||
    statusCode === '404' ||
    code === 'nosuchkey' ||
    code === 'not_found' ||
    message.includes('object not found') ||
    message.includes('the resource was not found') ||
    message.includes('no such key') ||
    message.includes('not found')
  );
}

export function mapSupabaseStorageError(
  error: SupabaseStorageErrorLike
): AppError {
  const status = error.status;
  const statusCode = (error.statusCode ?? '').trim();
  const code = (error.code ?? '').trim().toLowerCase();
  const message = (error.message ?? '').toLowerCase();

  if (isStorageNotFoundError(error)) {
    return new AppError(ERROR_CODES.SIMULADO_PDF_NOT_FOUND, 404);
  }

  if (
    status === 413 ||
    statusCode === '413' ||
    code === 'entitytoolarge' ||
    message.includes('payload too large') ||
    message.includes('maximum allowed size') ||
    message.includes('exceeded the maximum') ||
    message.includes('file size limit')
  ) {
    return new AppError(ERROR_CODES.SIMULADO_PDF_TOO_LARGE, 413);
  }

  if (
    status === 401 ||
    statusCode === '401' ||
    message.includes('unauthorized') ||
    message.includes('invalid jwt') ||
    message.includes('jwt expired')
  ) {
    return new AppError(ERROR_CODES.UNAUTHORIZED, 401);
  }

  if (
    status === 403 ||
    statusCode === '403' ||
    code === 'accessdenied' ||
    message.includes('row-level security') ||
    message.includes('forbidden') ||
    message.includes('permission denied') ||
    message.includes('access denied')
  ) {
    return new AppError(ERROR_CODES.FORBIDDEN, 403);
  }

  if (
    status === 415 ||
    statusCode === '415' ||
    message.includes('mime type') ||
    message.includes('invalid file')
  ) {
    return new AppError(ERROR_CODES.SIMULADO_PDF_INVALID_TYPE, 400);
  }

  return new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, 500);
}
