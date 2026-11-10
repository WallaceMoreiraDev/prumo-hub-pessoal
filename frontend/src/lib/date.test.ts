import { describe, expect, it } from 'vitest';
import {
  calculateDaysSinceReview,
  formatDaysSinceReview,
  startOfLocalDay,
} from '@/lib/date';

describe('date helpers (GEMINI.md 1.4)', () => {
  it('retorna null e "Nunca revisado" quando lastReviewedAt for null', () => {
    expect(calculateDaysSinceReview(null)).toBeNull();
    expect(formatDaysSinceReview(null)).toBe('Nunca revisado');
  });

  it('normaliza startOfLocalDay para 00:00:00.000 no fuso local', () => {
    const sample = new Date(2026, 10, 10, 23, 45, 30, 500);
    const normalized = startOfLocalDay(sample);

    expect(normalized.getFullYear()).toBe(2026);
    expect(normalized.getMonth()).toBe(10);
    expect(normalized.getDate()).toBe(10);
    expect(normalized.getHours()).toBe(0);
    expect(normalized.getMinutes()).toBe(0);
    expect(normalized.getSeconds()).toBe(0);
    expect(normalized.getMilliseconds()).toBe(0);
  });

  it('conta 1 dia ("Ontem") mesmo quando passaram apenas 20 minutos atravessando a meia-noite local', () => {
    const reviewed = new Date(2026, 10, 9, 23, 50, 0);
    const reference = new Date(2026, 10, 10, 0, 10, 0);

    expect(calculateDaysSinceReview(reviewed, reference)).toBe(1);
    expect(formatDaysSinceReview(reviewed, reference)).toBe('Ontem');
  });

  it('conta 0 dias ("Hoje") para horários distantes dentro do mesmo dia local', () => {
    const reviewed = new Date(2026, 10, 10, 0, 5, 0);
    const reference = new Date(2026, 10, 10, 23, 55, 0);

    expect(calculateDaysSinceReview(reviewed, reference)).toBe(0);
    expect(formatDaysSinceReview(reviewed, reference)).toBe('Hoje');
  });

  it('calcula múltiplos dias corretamente em virada de mês e ano', () => {
    const reviewed = new Date(2025, 11, 29, 22, 0, 0);
    const reference = new Date(2026, 0, 2, 7, 0, 0);

    expect(calculateDaysSinceReview(reviewed, reference)).toBe(4);
    expect(formatDaysSinceReview(reviewed, reference)).toBe('Há 4 dias');
  });

  it('não retorna número negativo caso lastReviewedAt esteja levemente no futuro', () => {
    const reviewed = new Date(2026, 10, 11, 10, 0, 0);
    const reference = new Date(2026, 10, 10, 10, 0, 0);

    expect(calculateDaysSinceReview(reviewed, reference)).toBe(0);
    expect(formatDaysSinceReview(reviewed, reference)).toBe('Hoje');
  });
});
