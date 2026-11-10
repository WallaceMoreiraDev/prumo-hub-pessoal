import {
  ERROR_CODES,
  type ApiValidationErrorDetail,
  type ErrorCode,
} from '@shared/types/api.types';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ERROR_CODES.VALIDATION_ERROR]:
    'Os dados informados são inválidos. Revise os campos destacados e tente novamente.',
  [ERROR_CODES.INVALID_JSON]:
    'O formato dos dados enviados na requisição é inválido.',
  [ERROR_CODES.UNAUTHORIZED]:
    'Sua sessão expirou ou não está autenticada. Faça login novamente.',
  [ERROR_CODES.FORBIDDEN]:
    'Você não tem permissão para acessar ou alterar este recurso.',
  [ERROR_CODES.NOT_FOUND]:
    'O recurso solicitado não foi encontrado.',
  [ERROR_CODES.CONFLICT]:
    'Já existe um registro conflitante com os dados informados.',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]:
    'Muitas requisições em sequência. Aguarde alguns segundos e tente novamente.',
  [ERROR_CODES.INTERNAL_SERVER_ERROR]:
    'Ocorreu um erro interno inesperado. Tente novamente em instantes.',
  [ERROR_CODES.SIMULADO_NOT_FOUND]:
    'Simulado não encontrado para a sua conta.',
  [ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION]:
    'Esta ação não é permitida para o status atual do simulado.',
  [ERROR_CODES.SIMULADO_REQUIRES_QUESTAO]:
    'Cadastre pelo menos uma questão no simulado antes de realizar esta operação.',
  [ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND]:
    'Questão do simulado não encontrada.',
  [ERROR_CODES.SIMULADO_PENSAMENTO_NOT_FOUND]:
    'Registro de pensamento do simulado não encontrado.',
  [ERROR_CODES.SIMULADO_PDF_NOT_FOUND]:
    'O arquivo PDF deste simulado não foi encontrado.',
  [ERROR_CODES.SIMULADO_PDF_INVALID_TYPE]:
    'Arquivo inválido. Envie exclusivamente um documento no formato PDF.',
  [ERROR_CODES.SIMULADO_PDF_TOO_LARGE]:
    'O arquivo PDF excede o tamanho máximo permitido para envio.',
  [ERROR_CODES.TEMA_NOT_FOUND]:
    'Tema não encontrado para a sua conta.',
  [ERROR_CODES.TEMA_ALREADY_EXISTS]:
    'Já existe um tema cadastrado com este nome.',
  [ERROR_CODES.TEMA_INVALID_NAME]:
    'Nome de tema inválido. O nome não pode estar vazio nem conter o caractere "#".',
  [ERROR_CODES.TEMAS_REQUIRED]:
    'Selecione pelo menos um tema para continuar.',
  [ERROR_CODES.REFLEXAO_NOT_FOUND]:
    'Reflexão ou conexão entre temas não encontrada.',
  [ERROR_CODES.REFLEXAO_SELF_CONNECTION]:
    'Não é permitido conectar um tema com ele mesmo.',
  [ERROR_CODES.CADERNO_ERRO_NOT_FOUND]:
    'Registro do Caderno de Erros não encontrado.',
  [ERROR_CODES.INVALID_MANUAL_ERROR_ORIGIN]:
    'Origem inválida para cadastro manual. Selecione Questão Externa ou Questão Genérica.',
  [ERROR_CODES.INVALID_REVIEW_MODE]:
    'Modo de revisão inválido. Utilize Finalizado Sozinho ou Com Ajuda.',
  [ERROR_CODES.INVALID_RESULTADO]:
    'Resultado da questão inválido. Utilize Acertei, Parcial ou Errei.',
};

const VALID_ERROR_CODE_SET = new Set<string>(Object.values(ERROR_CODES));

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && VALID_ERROR_CODE_SET.has(value);
}

export interface ApiClientErrorOptions {
  statusCode: number;
  code: ErrorCode;
  details?: ApiValidationErrorDetail[];
  message?: string;
}

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ApiValidationErrorDetail[];

  constructor({ statusCode, code, details, message }: ApiClientErrorOptions) {
    const resolvedMessage =
      message ??
      (code === ERROR_CODES.VALIDATION_ERROR && details?.[0]?.message
        ? details[0].message
        : ERROR_MESSAGES[code]);

    super(resolvedMessage);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (
      error.code === ERROR_CODES.VALIDATION_ERROR &&
      error.details &&
      error.details.length > 0 &&
      error.details[0]?.message
    ) {
      return error.details[0].message;
    }

    return ERROR_MESSAGES[error.code];
  }

  if (error instanceof TypeError) {
    return 'Não foi possível conectar ao servidor da API. Verifique sua rede e se o backend está ativo.';
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return ERROR_MESSAGES[ERROR_CODES.INTERNAL_SERVER_ERROR];
}

export function getValidationFieldErrors(
  error: unknown
): Record<string, string> {
  if (!(error instanceof ApiClientError) || !error.details) {
    return {};
  }

  const fieldMap: Record<string, string> = {};
  for (const detail of error.details) {
    if (detail.path && !fieldMap[detail.path]) {
      fieldMap[detail.path] = detail.message;
    }
  }

  return fieldMap;
}

export function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const rawMessage = String(error.message).toLowerCase();

    if (rawMessage.includes('invalid login credentials')) {
      return 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.';
    }
    if (rawMessage.includes('email not confirmed')) {
      return 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.';
    }
    if (
      rawMessage.includes('user already registered') ||
      rawMessage.includes('already been registered')
    ) {
      return 'Já existe uma conta cadastrada com este endereço de e-mail.';
    }
    if (rawMessage.includes('password should be at least')) {
      return 'A senha precisa ter pelo menos 6 caracteres.';
    }
    if (rawMessage.includes('unable to validate email address')) {
      return 'Informe um endereço de e-mail válido.';
    }
    if (rawMessage.includes('rate limit') || rawMessage.includes('too many requests')) {
      return 'Muitas tentativas em sequência. Aguarde alguns instantes antes de tentar novamente.';
    }
    if (rawMessage.includes('failed to fetch') || rawMessage.includes('network')) {
      return 'Não foi possível conectar ao serviço de autenticação. Verifique sua conexão.';
    }
  }

  return 'Não foi possível concluir a autenticação. Tente novamente.';
}
