import {
  SIMULADO_PDF_MAX_SIZE_BYTES,
  type SimuladoDetalheDto,
  type SimuladoPensamentoDto,
  type SimuladoQuestaoDto,
} from '@shared/types/simulados.types';
import { describe, expect, it } from 'vitest';
import {
  buildMarkdownDownloadFilename,
  calculateSimuladoTimerSnapshot,
  clearSimuladoTimerMirror,
  comparePensamentosCronologico,
  formatClockDuration,
  formatConfiguredDuration,
  formatPdfFileSize,
  hoursMinutesToSeconds,
  parseThoughtTimestampInput,
  readSimuladoTimerMirror,
  removePensamentoFromSimuladoDetalhe,
  resolveTimerConfig,
  saveSimuladoTimerMirror,
  secondsToHoursMinutes,
  summarizeSimuladoResultados,
  upsertPensamentoInSimuladoDetalhe,
  validatePdfFileClient,
} from './simulados';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

function makePensamento(
  overrides: Partial<SimuladoPensamentoDto> = {}
): SimuladoPensamentoDto {
  return {
    id: 'p-1',
    userId: 'u-1',
    simuladoQuestaoId: 'q-1',
    descricao: 'Ideia inicial',
    tempoDecorridoSegundos: 60,
    createdAt: '2026-11-10T14:01:00.000Z',
    updatedAt: '2026-11-10T14:01:00.000Z',
    ...overrides,
  };
}

function makeQuestao(
  overrides: Partial<SimuladoQuestaoDto> = {}
): SimuladoQuestaoDto {
  return {
    id: 'q-1',
    userId: 'u-1',
    simuladoId: 's-1',
    numeroQuestao: 'Q1',
    tituloQuestao: 'Grafos',
    ordem: 1,
    resultado: null,
    observacaoPosRevisao: null,
    temas: [],
    pensamentos: [],
    createdAt: '2026-11-10T13:30:00.000Z',
    updatedAt: '2026-11-10T13:30:00.000Z',
    ...overrides,
  };
}

function makeDetalhe(questoes: SimuladoQuestaoDto[]): SimuladoDetalheDto {
  return {
    id: 's-1',
    userId: 'u-1',
    titulo: 'OBI Simulado 1',
    duracaoConfiguradaSegundos: 7200,
    tempoGastoSegundos: 0,
    pdfStoragePath: null,
    hasPdf: false,
    status: 'EM_ANDAMENTO',
    startedAt: '2026-11-10T14:00:00.000Z',
    finishedAt: null,
    createdAt: '2026-11-10T13:30:00.000Z',
    updatedAt: '2026-11-10T14:00:00.000Z',
    pdfSignedUrl: null,
    questoes,
  };
}

describe('simulados utils', () => {
  it('formata e converte durações corretamente', () => {
    expect(formatClockDuration(0)).toBe('00:00:00');
    expect(formatClockDuration(-15)).toBe('00:00:00');
    expect(formatClockDuration(9910)).toBe('02:45:10');

    expect(hoursMinutesToSeconds(4, 30)).toBe(16200);
    expect(secondsToHoursMinutes(16200)).toEqual({ hours: 4, minutes: 30 });
    expect(secondsToHoursMinutes(45)).toEqual({ hours: 0, minutes: 1 });
    expect(secondsToHoursMinutes(90000)).toEqual({ hours: 24, minutes: 0 });

    expect(formatConfiguredDuration(7200)).toBe('2h');
    expect(formatConfiguredDuration(5400)).toBe('1h 30min');
    expect(formatConfiguredDuration(2700)).toBe('45min');
    expect(formatConfiguredDuration(30)).toBe('30s');
  });

  it('calcula cronômetro resiliente baseado em startedAt (incluindo overtime e fallback)', () => {
    const startedAt = '2026-11-10T14:00:00.000Z';
    const startMs = Date.parse(startedAt);

    expect(
      calculateSimuladoTimerSnapshot({
        startedAt,
        duracaoConfiguradaSegundos: 3600,
        nowMs: startMs + 900_500,
      })
    ).toEqual({
      elapsedSeconds: 900,
      remainingSeconds: 2700,
      isOvertime: false,
      overtimeSeconds: 0,
    });

    expect(
      calculateSimuladoTimerSnapshot({
        startedAt,
        duracaoConfiguradaSegundos: 3600,
        nowMs: startMs + 3600_000,
      })
    ).toEqual({
      elapsedSeconds: 3600,
      remainingSeconds: 0,
      isOvertime: false,
      overtimeSeconds: 0,
    });

    expect(
      calculateSimuladoTimerSnapshot({
        startedAt,
        duracaoConfiguradaSegundos: 3600,
        nowMs: startMs + 3725_000,
      })
    ).toEqual({
      elapsedSeconds: 3725,
      remainingSeconds: 0,
      isOvertime: true,
      overtimeSeconds: 125,
    });

    expect(
      calculateSimuladoTimerSnapshot({
        startedAt: null,
        duracaoConfiguradaSegundos: 7200,
        nowMs: startMs + 1000,
      })
    ).toEqual({
      elapsedSeconds: 0,
      remainingSeconds: 7200,
      isOvertime: false,
      overtimeSeconds: 0,
    });
  });

  it('persiste e reconcilia espelho local do timer com prioridade para o backend', () => {
    const storage = createMemoryStorage();
    saveSimuladoTimerMirror(
      {
        simuladoId: 's-1',
        startedAt: '2026-11-10T14:00:00.000Z',
        duracaoConfiguradaSegundos: 7200,
        updatedAt: '2026-11-10T14:10:00.000Z',
      },
      storage
    );

    expect(readSimuladoTimerMirror('s-1', storage)).toMatchObject({
      simuladoId: 's-1',
      startedAt: '2026-11-10T14:00:00.000Z',
      duracaoConfiguradaSegundos: 7200,
    });

    // Backend oficial prevalece sobre espelho local
    expect(
      resolveTimerConfig({
        simuladoId: 's-1',
        startedAt: '2026-11-10T14:05:00.000Z',
        duracaoConfiguradaSegundos: 10800,
        storage,
      })
    ).toEqual({
      startedAt: '2026-11-10T14:05:00.000Z',
      duracaoConfiguradaSegundos: 10800,
    });

    // Fallback seguro quando startedAt vier ausente momentaneamente
    expect(
      resolveTimerConfig({
        simuladoId: 's-1',
        startedAt: null,
        duracaoConfiguradaSegundos: 7200,
        storage,
      })
    ).toEqual({
      startedAt: '2026-11-10T14:00:00.000Z',
      duracaoConfiguradaSegundos: 7200,
    });

    clearSimuladoTimerMirror('s-1', storage);
    expect(readSimuladoTimerMirror('s-1', storage)).toBeNull();
  });

  it('valida arquivos PDF por tamanho, extensão e MIME type', () => {
    expect(
      validatePdfFileClient({
        name: 'prova.pdf',
        size: 1024,
        type: 'application/pdf',
      })
    ).toEqual({ valid: true });

    expect(
      validatePdfFileClient({
        name: 'prova.PDF',
        size: SIMULADO_PDF_MAX_SIZE_BYTES,
        type: '',
      })
    ).toEqual({ valid: true });

    expect(
      validatePdfFileClient({
        name: 'vazio.pdf',
        size: 0,
        type: 'application/pdf',
      })
    ).toEqual({
      valid: false,
      message: 'O arquivo selecionado está vazio.',
    });

    expect(
      validatePdfFileClient({
        name: 'grande.pdf',
        size: SIMULADO_PDF_MAX_SIZE_BYTES + 1,
        type: 'application/pdf',
      })
    ).toEqual({
      valid: false,
      message: 'O arquivo PDF excede o limite máximo de 20 MiB.',
    });

    expect(
      validatePdfFileClient({
        name: 'imagem.png',
        size: 500,
        type: 'image/png',
      }).valid
    ).toBe(false);

    expect(formatPdfFileSize(512)).toBe('512 B');
    expect(formatPdfFileSize(1536)).toBe('1,5 KB');
    expect(formatPdfFileSize(3 * 1024 * 1024)).toBe('3,0 MB');
  });

  it('ordena pensamentos com NULLS LAST e atualiza/remove cache sem perder ordem', () => {
    const pLateNull = makePensamento({
      id: 'p-null',
      tempoDecorridoSegundos: null,
      createdAt: '2026-11-10T14:00:00.000Z',
    });
    const p30 = makePensamento({
      id: 'p-30',
      tempoDecorridoSegundos: 30,
      createdAt: '2026-11-10T14:00:30.000Z',
    });
    const p90 = makePensamento({
      id: 'p-90',
      tempoDecorridoSegundos: 90,
      createdAt: '2026-11-10T14:01:30.000Z',
    });

    expect(
      [pLateNull, p90, p30].sort(comparePensamentosCronologico).map((p) => p.id)
    ).toEqual(['p-30', 'p-90', 'p-null']);

    const detalhe = makeDetalhe([
      makeQuestao({ id: 'q-1', pensamentos: [p30, pLateNull] }),
      makeQuestao({ id: 'q-2', ordem: 2, numeroQuestao: 'Q2', pensamentos: [] }),
    ]);

    const afterInsert = upsertPensamentoInSimuladoDetalhe(detalhe, p90);
    expect(afterInsert.questoes[0]?.pensamentos.map((p) => p.id)).toEqual([
      'p-30',
      'p-90',
      'p-null',
    ]);

    // Mover pensamento para q-2 ao editar
    const moved = upsertPensamentoInSimuladoDetalhe(afterInsert, {
      ...p90,
      simuladoQuestaoId: 'q-2',
    });
    expect(moved.questoes[0]?.pensamentos.map((p) => p.id)).toEqual([
      'p-30',
      'p-null',
    ]);
    expect(moved.questoes[1]?.pensamentos.map((p) => p.id)).toEqual(['p-90']);

    const afterRemove = removePensamentoFromSimuladoDetalhe(moved, 'p-30');
    expect(afterRemove.questoes[0]?.pensamentos.map((p) => p.id)).toEqual([
      'p-null',
    ]);
  });

  it('interpreta carimbos de tempo editáveis em MM:SS e HH:MM:SS', () => {
    expect(parseThoughtTimestampInput('   ')).toEqual({
      valid: true,
      seconds: null,
    });
    expect(parseThoughtTimestampInput('14:30')).toEqual({
      valid: true,
      seconds: 870,
    });
    expect(parseThoughtTimestampInput('01:02:03')).toEqual({
      valid: true,
      seconds: 3723,
    });
    expect(parseThoughtTimestampInput('12:75').valid).toBe(false);
    expect(parseThoughtTimestampInput('abc').valid).toBe(false);
  });

  it('sumariza resultados pós-prova e gera nome seguro de arquivo Markdown', () => {
    const resumo = summarizeSimuladoResultados([
      makeQuestao({ id: '1', resultado: 'ACERTEI' }),
      makeQuestao({ id: '2', resultado: 'PARCIAL' }),
      makeQuestao({ id: '3', resultado: 'ERREI' }),
      makeQuestao({ id: '4', resultado: null }),
    ]);

    expect(resumo).toEqual({
      total: 4,
      classificadas: 3,
      acertos: 1,
      parciais: 1,
      erros: 1,
      pendentes: 1,
    });

    expect(buildMarkdownDownloadFilename('OBI 2024 — Fase 2 (Turno B)')).toBe(
      'obi-2024-fase-2-turno-b.md'
    );
    expect(buildMarkdownDownloadFilename('   ')).toBe('simulado-revisao.md');
  });
});
