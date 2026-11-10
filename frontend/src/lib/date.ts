const MS_PER_DAY = 86_400_000;

/**
 * Retorna uma nova instância Date normalizada às 00:00:00.000 no fuso horário local do usuário.
 */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/**
 * Converte a data de calendário local (ano/mês/dia) para timestamp UTC às 00:00:00
 * para evitar desvios de 23h/25h em transições de horário de verão (DST).
 */
function toLocalCalendarUtcEpoch(date: Date): number {
  const localMidnight = startOfLocalDay(date);
  return Date.UTC(
    localMidnight.getFullYear(),
    localMidnight.getMonth(),
    localMidnight.getDate()
  );
}

function parseDateInput(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

/**
 * Calcula quantos dias de calendário locais se passaram desde `lastReviewedAt`.
 * Regra GEMINI.md 1.4: compara datas de calendário locais normalizadas no início do dia (00:00:00),
 * nunca dividindo milissegundos brutos por 24 horas.
 */
export function calculateDaysSinceReview(
  lastReviewedAt: string | Date | null,
  referenceDate: Date = new Date()
): number | null {
  const reviewedDate = parseDateInput(lastReviewedAt);
  if (!reviewedDate) {
    return null;
  }

  const reviewedDayEpoch = toLocalCalendarUtcEpoch(reviewedDate);
  const referenceDayEpoch = toLocalCalendarUtcEpoch(referenceDate);

  const diffDays = Math.round((referenceDayEpoch - reviewedDayEpoch) / MS_PER_DAY);
  return Math.max(0, diffDays);
}

export function formatDaysSinceReview(
  lastReviewedAt: string | Date | null,
  referenceDate: Date = new Date()
): string {
  const days = calculateDaysSinceReview(lastReviewedAt, referenceDate);

  if (days === null) {
    return 'Nunca revisado';
  }
  if (days === 0) {
    return 'Hoje';
  }
  if (days === 1) {
    return 'Ontem';
  }

  return `Há ${days} dias`;
}

export function formatLocalDate(value: string | Date | null): string {
  const parsed = parseDateInput(value);
  if (!parsed) {
    return '—';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

export function formatLocalDateTime(value: string | Date | null): string {
  const parsed = parseDateInput(value);
  if (!parsed) {
    return '—';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}
