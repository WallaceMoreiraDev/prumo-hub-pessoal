import type { UpdateCadernoErroInput } from '@shared/schemas/caderno-erros.schema';
import type {
  ErroOrigem,
  ManualErrorOrigin,
  QuestaoResultado,
} from '@shared/types/enums.types';
import { isSafeHttpUrl } from '@/lib/url';

export { isSafeHttpUrl };

export const ERRO_ORIGEM_LABELS: Record<ErroOrigem, string> = {
  SIMULADO: 'Simulado',
  EXTERNAL_LINK: 'Questão Externa',
  GENERIC_FULL: 'Questão Genérica',
};

export const MANUAL_ORIGEM_OPTIONS: ReadonlyArray<{
  value: ManualErrorOrigin;
  label: string;
  description: string;
}> = [
  {
    value: 'EXTERNAL_LINK',
    label: 'Questão Externa / Link',
    description:
      'Referência curta (ex.: 222A, Q138) + link direto para plataforma externa.',
  },
  {
    value: 'GENERIC_FULL',
    label: 'Questão Genérica / Completa',
    description:
      'Título, enunciado completo da questão e link opcional de referência.',
  },
];

export const QUESTAO_RESULTADO_LABELS: Record<QuestaoResultado, string> = {
  ACERTEI: 'Acertei',
  PARCIAL: 'Parcial',
  ERREI: 'Errei',
};

function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Formata segundos decorridos em `MM:SS` (ex.: 14 -> "00:14", 1840 -> "30:40")
 * ou `HH:MM:SS` quando >= 3600 (ex.: 3665 -> "01:01:05").
 * Retorna `null` quando `seconds` for nulo, inválido ou negativo.
 */
export function formatTempoDecorrido(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}:${padTwoDigits(secs)}`;
  }

  return `${padTwoDigits(minutes)}:${padTwoDigits(secs)}`;
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function deduplicateTemaIds(temaIds: readonly string[]): string[] {
  return [...new Set(temaIds)];
}

export interface BuildUpdateCadernoErroPayloadInput {
  origem: ErroOrigem;
  codigoReferencia?: string | null;
  titulo?: string | null;
  enunciadoCompleto?: string | null;
  linkExterno?: string | null;
  observacaoErro?: string | null;
  temaIds: readonly string[];
}

export type UpdateCadernoErroPayload = Partial<UpdateCadernoErroInput>;

/**
 * Constrói o payload de PATCH `/caderno-erros/:id` estritamente alinhado à origem do registro:
 * - `SIMULADO`: envia exclusivamente `{ observacaoErro, temaIds }`.
 * - `EXTERNAL_LINK`: envia `{ codigoReferencia, linkExterno, titulo, observacaoErro, temaIds }`,
 *   aplicando fallback de `titulo` para `codigoReferencia.trim()` quando vazio e omitindo `enunciadoCompleto`.
 * - `GENERIC_FULL`: envia `{ titulo, enunciadoCompleto, linkExterno, observacaoErro, temaIds }`,
 *   normalizando `linkExterno` vazio para `null` e omitindo `codigoReferencia`.
 */
export function buildUpdateCadernoErroPayload(
  input: BuildUpdateCadernoErroPayloadInput
): UpdateCadernoErroPayload {
  const observacaoErro = normalizeNullableText(input.observacaoErro);
  const temaIds = deduplicateTemaIds(input.temaIds);

  if (input.origem === 'SIMULADO') {
    return {
      observacaoErro,
      temaIds,
    };
  }

  if (input.origem === 'EXTERNAL_LINK') {
    const codigoReferencia = (input.codigoReferencia ?? '').trim();
    const trimmedTitulo = (input.titulo ?? '').trim();
    const titulo = trimmedTitulo.length > 0 ? trimmedTitulo : codigoReferencia;
    const linkExterno = (input.linkExterno ?? '').trim();

    return {
      codigoReferencia,
      linkExterno,
      titulo,
      observacaoErro,
      temaIds,
    };
  }

  return {
    titulo: (input.titulo ?? '').trim(),
    enunciadoCompleto: (input.enunciadoCompleto ?? '').trim(),
    linkExterno: normalizeNullableText(input.linkExterno),
    observacaoErro,
    temaIds,
  };
}
