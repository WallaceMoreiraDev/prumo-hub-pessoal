import type { SimuladoStatus } from '@shared/types/enums.types';
import {
  SIMULADO_PDF_MAX_SIZE_BYTES,
  type SimuladoDetalheDto,
  type SimuladoPensamentoDto,
  type SimuladoQuestaoDto,
} from '@shared/types/simulados.types';

export const SIMULADO_STATUS_LABELS: Readonly<Record<SimuladoStatus, string>> = {
  PREPARACAO: 'Em Preparação',
  EM_ANDAMENTO: 'Em Andamento',
  FINALIZADO: 'Finalizado',
};

export const SIMULADO_DURATION_PRESETS: ReadonlyArray<{
  label: string;
  hours: number;
  minutes: number;
}> = [
  { label: '1h', hours: 1, minutes: 0 },
  { label: '2h', hours: 2, minutes: 0 },
  { label: '4h', hours: 4, minutes: 0 },
  { label: '5h', hours: 5, minutes: 0 },
];

export const SIMULADO_MAX_DURATION_SECONDS = 86_400;
export const SIMULADO_TIMER_MIRROR_PREFIX = 'prumo-simulado-timer:';

const ALLOWED_PDF_MIME_TYPES = new Set<string>([
  'application/pdf',
  'application/x-pdf',
]);

const GENERIC_OR_EMPTY_MIME_TYPES = new Set<string>([
  '',
  'application/octet-stream',
]);

function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatClockDuration(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`;
}

export function hoursMinutesToSeconds(hours: number, minutes: number): number {
  const safeHours = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
  const safeMinutes = Number.isFinite(minutes)
    ? Math.max(0, Math.floor(minutes))
    : 0;
  return safeHours * 3600 + safeMinutes * 60;
}

export function secondsToHoursMinutes(totalSeconds: number): {
  hours: number;
  minutes: number;
} {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return { hours: 0, minutes: 0 };
  }

  const clamped = Math.min(
    SIMULADO_MAX_DURATION_SECONDS,
    Math.floor(totalSeconds)
  );
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);

  if (hours === 0 && minutes === 0) {
    return { hours: 0, minutes: 1 };
  }

  return { hours, minutes };
}

export function formatConfiguredDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '0min';
  }

  const safe = Math.floor(totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}min`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}min`;
  }
  return `${seconds}s`;
}

export interface CalculateSimuladoTimerInput {
  startedAt: string | null | undefined;
  duracaoConfiguradaSegundos: number;
  nowMs?: number;
}

export interface SimuladoTimerSnapshot {
  elapsedSeconds: number;
  remainingSeconds: number;
  isOvertime: boolean;
  overtimeSeconds: number;
}

export function calculateSimuladoTimerSnapshot({
  startedAt,
  duracaoConfiguradaSegundos,
  nowMs = Date.now(),
}: CalculateSimuladoTimerInput): SimuladoTimerSnapshot {
  const safeDuration = Number.isFinite(duracaoConfiguradaSegundos)
    ? Math.max(1, Math.floor(duracaoConfiguradaSegundos))
    : 1;

  const startedMs = startedAt ? Date.parse(startedAt) : Number.NaN;
  if (Number.isNaN(startedMs) || !Number.isFinite(nowMs)) {
    return {
      elapsedSeconds: 0,
      remainingSeconds: safeDuration,
      isOvertime: false,
      overtimeSeconds: 0,
    };
  }

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
  if (elapsedSeconds <= safeDuration) {
    return {
      elapsedSeconds,
      remainingSeconds: safeDuration - elapsedSeconds,
      isOvertime: false,
      overtimeSeconds: 0,
    };
  }

  return {
    elapsedSeconds,
    remainingSeconds: 0,
    isOvertime: true,
    overtimeSeconds: elapsedSeconds - safeDuration,
  };
}

export interface SimuladoTimerMirror {
  simuladoId: string;
  startedAt: string;
  duracaoConfiguradaSegundos: number;
  updatedAt: string;
}

function getTimerMirrorKey(simuladoId: string): string {
  return `${SIMULADO_TIMER_MIRROR_PREFIX}${simuladoId}`;
}

export function saveSimuladoTimerMirror(
  mirror: SimuladoTimerMirror,
  storage?: Pick<Storage, 'setItem'>
): void {
  const targetStorage =
    storage ??
    (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!targetStorage) {
    return;
  }

  try {
    targetStorage.setItem(
      getTimerMirrorKey(mirror.simuladoId),
      JSON.stringify(mirror)
    );
  } catch {
    // Ignora falha caso storage esteja bloqueado ou indisponível.
  }
}

export function readSimuladoTimerMirror(
  simuladoId: string,
  storage?: Pick<Storage, 'getItem'>
): SimuladoTimerMirror | null {
  const targetStorage =
    storage ??
    (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!targetStorage) {
    return null;
  }

  try {
    const raw = targetStorage.getItem(getTimerMirrorKey(simuladoId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (
      record.simuladoId !== simuladoId ||
      typeof record.startedAt !== 'string' ||
      Number.isNaN(Date.parse(record.startedAt)) ||
      typeof record.duracaoConfiguradaSegundos !== 'number' ||
      !Number.isFinite(record.duracaoConfiguradaSegundos) ||
      record.duracaoConfiguradaSegundos < 1
    ) {
      return null;
    }

    return {
      simuladoId,
      startedAt: record.startedAt,
      duracaoConfiguradaSegundos: Math.floor(record.duracaoConfiguradaSegundos),
      updatedAt:
        typeof record.updatedAt === 'string'
          ? record.updatedAt
          : record.startedAt,
    };
  } catch {
    return null;
  }
}

export function clearSimuladoTimerMirror(
  simuladoId: string,
  storage?: Pick<Storage, 'removeItem'>
): void {
  const targetStorage =
    storage ??
    (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!targetStorage) {
    return;
  }

  try {
    targetStorage.removeItem(getTimerMirrorKey(simuladoId));
  } catch {
    // Ignora falha caso storage esteja bloqueado.
  }
}

export function resolveTimerConfig({
  simuladoId,
  startedAt,
  duracaoConfiguradaSegundos,
  storage,
}: {
  simuladoId: string;
  startedAt: string | null | undefined;
  duracaoConfiguradaSegundos: number;
  storage?: Pick<Storage, 'getItem'>;
}): {
  startedAt: string | null;
  duracaoConfiguradaSegundos: number;
} {
  const hasValidBackendStartedAt =
    typeof startedAt === 'string' && !Number.isNaN(Date.parse(startedAt));

  if (hasValidBackendStartedAt && duracaoConfiguradaSegundos >= 1) {
    return {
      startedAt,
      duracaoConfiguradaSegundos,
    };
  }

  const mirror = readSimuladoTimerMirror(simuladoId, storage);
  if (mirror) {
    return {
      startedAt: mirror.startedAt,
      duracaoConfiguradaSegundos:
        duracaoConfiguradaSegundos >= 1
          ? duracaoConfiguradaSegundos
          : mirror.duracaoConfiguradaSegundos,
    };
  }

  return {
    startedAt: null,
    duracaoConfiguradaSegundos: Math.max(1, duracaoConfiguradaSegundos),
  };
}

export type PdfValidationResult =
  | { valid: true }
  | { valid: false; message: string };

export function validatePdfFileClient(file: {
  name: string;
  size: number;
  type: string;
}): PdfValidationResult {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return {
      valid: false,
      message: 'O arquivo selecionado está vazio.',
    };
  }

  if (file.size > SIMULADO_PDF_MAX_SIZE_BYTES) {
    return {
      valid: false,
      message: 'O arquivo PDF excede o limite máximo de 20 MiB.',
    };
  }

  const normalizedMime = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
  const hasPdfExtension = file.name.trim().toLowerCase().endsWith('.pdf');

  if (ALLOWED_PDF_MIME_TYPES.has(normalizedMime)) {
    return { valid: true };
  }

  if (GENERIC_OR_EMPTY_MIME_TYPES.has(normalizedMime) && hasPdfExtension) {
    return { valid: true };
  }

  return {
    valid: false,
    message: 'Arquivo inválido. Selecione exclusivamente um documento PDF (.pdf).',
  };
}

export function formatPdfFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export function comparePensamentosCronologico(
  a: SimuladoPensamentoDto,
  b: SimuladoPensamentoDto
): number {
  if (a.tempoDecorridoSegundos !== b.tempoDecorridoSegundos) {
    if (a.tempoDecorridoSegundos === null) {
      return 1;
    }
    if (b.tempoDecorridoSegundos === null) {
      return -1;
    }
    return a.tempoDecorridoSegundos - b.tempoDecorridoSegundos;
  }

  const timeA = Date.parse(a.createdAt);
  const timeB = Date.parse(b.createdAt);
  if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
    return timeA - timeB;
  }

  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1;
  }

  return a.id.localeCompare(b.id);
}

export function upsertPensamentoInSimuladoDetalhe(
  detalhe: SimuladoDetalheDto,
  pensamento: SimuladoPensamentoDto
): SimuladoDetalheDto {
  return {
    ...detalhe,
    questoes: detalhe.questoes.map((questao) => {
      const remaining = questao.pensamentos.filter(
        (item) => item.id !== pensamento.id
      );

      if (questao.id !== pensamento.simuladoQuestaoId) {
        if (remaining.length === questao.pensamentos.length) {
          return questao;
        }
        return {
          ...questao,
          pensamentos: remaining,
        };
      }

      const nextPensamentos = [...remaining, pensamento].sort(
        comparePensamentosCronologico
      );
      return {
        ...questao,
        pensamentos: nextPensamentos,
      };
    }),
  };
}

export function removePensamentoFromSimuladoDetalhe(
  detalhe: SimuladoDetalheDto,
  pensamentoId: string
): SimuladoDetalheDto {
  return {
    ...detalhe,
    questoes: detalhe.questoes.map((questao) => {
      const nextPensamentos = questao.pensamentos.filter(
        (item) => item.id !== pensamentoId
      );
      if (nextPensamentos.length === questao.pensamentos.length) {
        return questao;
      }
      return {
        ...questao,
        pensamentos: nextPensamentos,
      };
    }),
  };
}

export function upsertQuestaoInSimuladoDetalhe(
  detalhe: SimuladoDetalheDto,
  updatedQuestao: SimuladoQuestaoDto
): SimuladoDetalheDto {
  const exists = detalhe.questoes.some((q) => q.id === updatedQuestao.id);
  if (!exists) {
    return {
      ...detalhe,
      questoes: [...detalhe.questoes, updatedQuestao],
    };
  }

  return {
    ...detalhe,
    questoes: detalhe.questoes.map((questao) =>
      questao.id === updatedQuestao.id ? updatedQuestao : questao
    ),
  };
}

export type ParseTimestampResult =
  | { valid: true; seconds: number | null }
  | { valid: false; message: string };

/**
 * Converte string de tempo digitada pelo usuário (`MM:SS` ou `HH:MM:SS`) em segundos inteiros.
 * Strings vazias retornam `null`.
 */
export function parseThoughtTimestampInput(
  rawValue: string
): ParseTimestampResult {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return { valid: true, seconds: null };
  }

  const parts = trimmed.split(':');
  if (parts.length !== 2 && parts.length !== 3) {
    return {
      valid: false,
      message: 'Use o formato MM:SS ou HH:MM:SS (ex.: 14:30 ou 01:05:20).',
    };
  }

  if (parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return {
      valid: false,
      message: 'Use apenas números separados por ":" (ex.: 14:30).',
    };
  }

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (parts.length === 2) {
    minutes = Number(parts[0]);
    seconds = Number(parts[1]);
  } else {
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
    seconds = Number(parts[2]);
    if (minutes > 59) {
      return {
        valid: false,
        message: 'Os minutos devem estar entre 00 e 59 no formato HH:MM:SS.',
      };
    }
  }

  if (seconds > 59) {
    return {
      valid: false,
      message: 'Os segundos devem estar entre 00 e 59.',
    };
  }

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  if (!Number.isSafeInteger(totalSeconds) || totalSeconds < 0 || totalSeconds > 864_000) {
    return {
      valid: false,
      message: 'O tempo informado excede o limite permitido (240h).',
    };
  }

  return { valid: true, seconds: totalSeconds };
}

export interface SimuladoResultadosResumo {
  total: number;
  classificadas: number;
  acertos: number;
  parciais: number;
  erros: number;
  pendentes: number;
}

export function summarizeSimuladoResultados(
  questoes: readonly SimuladoQuestaoDto[]
): SimuladoResultadosResumo {
  let acertos = 0;
  let parciais = 0;
  let erros = 0;
  let pendentes = 0;

  for (const questao of questoes) {
    if (questao.resultado === 'ACERTEI') {
      acertos += 1;
    } else if (questao.resultado === 'PARCIAL') {
      parciais += 1;
    } else if (questao.resultado === 'ERREI') {
      erros += 1;
    } else {
      pendentes += 1;
    }
  }

  return {
    total: questoes.length,
    classificadas: acertos + parciais + erros,
    acertos,
    parciais,
    erros,
    pendentes,
  };
}

export function buildMarkdownDownloadFilename(titulo: string): string {
  const normalized = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${normalized || 'simulado-revisao'}.md`;
}
