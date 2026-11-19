// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import type {
  EstudoExportIaDto,
  EstudosResumoPeriodoDto,
} from '@shared/types/exercicios.types';
import type { TemaSummaryDto } from '@shared/types/temas.types';
import { afterEach, describe, expect, it, vi } from 'vitest';

const TEMA_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEMA_MOCK: TemaSummaryDto = {
  id: TEMA_ID,
  nome: 'Grafos e DFS',
  lastReviewedAt: null,
  lastReviewMode: null,
};

const TEMA_2_ID = '550e8400-e29b-41d4-a716-446655440002';

const RESUMO_MOCK: EstudosResumoPeriodoDto = {
  periodo: 'dia',
  dataReferencia: '2026-11-18',
  dataInicioIso: '2026-11-18T00:00:00.000Z',
  dataFimIso: '2026-11-18T23:59:59.999Z',
  tempoTotalSegundos: 9000,
  totalExercicios: 5,
  totalSolo: 3,
  totalHelp: 2,
  totalSemDesfecho: 0,
  totalReflexoes: 3,
  temasAbordados: [
    {
      temaId: TEMA_ID,
      nomeTema: 'Grafos e DFS',
      totalExercicios: 2,
      totalReflexoes: 1,
      tempoTotalSegundos: 3600,
      desfechos: {
        solo: 1,
        help: 1,
        semDesfecho: 0,
      },
    },
    {
      temaId: TEMA_2_ID,
      nomeTema: 'Programação Dinâmica',
      totalExercicios: 3,
      totalReflexoes: 2,
      tempoTotalSegundos: 5400,
      desfechos: {
        solo: 2,
        help: 1,
        semDesfecho: 0,
      },
    },
  ],
  itens: [
    {
      tipo: 'EXERCICIO',
      id: 'ex-1',
      titulo: 'Codeforces 1899A',
      createdAt: '2026-11-18T14:30:00.000Z',
      duracaoSegundos: 1800,
      desfecho: 'SOLO',
      temas: [TEMA_MOCK],
      hasLousa: false,
    },
  ],
};

const EXPORT_IA_MOCK: EstudoExportIaDto = {
  periodoLabel: 'Hoje (18/11/2026)',
  dataInicioIso: '2026-11-18T00:00:00.000Z',
  dataFimIso: '2026-11-18T23:59:59.999Z',
  markdown: '# Relatório de Estudos do Prumo',
};

let mockResumoResult = {
  data: RESUMO_MOCK,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
};

vi.mock('@/features/exercicios/hooks/useExercicios', () => ({
  useEstudosResumoQuery: () => mockResumoResult,
  useEstudoExportIaQuery: () => ({
    data: EXPORT_IA_MOCK,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useExercicioDetalheQuery: () => ({ data: null, isLoading: false }),
  useCreateExercicioMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExercicioMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteExercicioMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/features/temas-revisao/hooks/useTemas', () => ({
  useTemasOptionsQuery: () => ({ data: { items: [] }, isLoading: false }),
  useCreateTemaMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  temasKeys: { all: ['temas'] },
}));

vi.mock('@/features/lousas/api/lousasApi', () => ({
  lousasApi: { deleteLousa: vi.fn() },
}));

vi.mock('@/components/markdown/MarkdownMathRenderer', () => ({
  MarkdownMathRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock('@/features/lousas/components/LousaCanvasModal', () => ({
  LousaCanvasModal: () => null,
}));

import { EstudosResumoView } from '@/features/exercicios/components/EstudosResumoView';

let mountContainer: HTMLDivElement | null = null;
let activeRoot: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  if (activeRoot) {
    act(() => {
      activeRoot?.unmount();
    });
    activeRoot = null;
  }
  mountContainer?.remove();
  mountContainer = null;
  document.body.innerHTML = '';
  mockResumoResult = {
    data: RESUMO_MOCK,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  };
});

function renderDom(element: React.ReactElement): HTMLDivElement {
  mountContainer = document.createElement('div');
  document.body.appendChild(mountContainer);
  activeRoot = createRoot(mountContainer);
  act(() => {
    activeRoot?.render(element);
  });
  return mountContainer;
}

describe('EstudosResumoView', () => {
  it('renderiza os cards de métricas e histórico de atividades', () => {
    renderDom(<EstudosResumoView />);

    expect(document.body.textContent).toContain('Tempo Total de Foco');
    expect(document.body.textContent).toContain('Exercícios Resolvidos');
    expect(document.body.textContent).toContain('Reflexões & Conexões');
    expect(document.body.textContent).toContain('Codeforces 1899A');
    expect(document.body.textContent).toContain('Exportar para IA');
  });

  it('pluraliza reflexões corretamente no singular e plural sem duplicar sufixo', () => {
    renderDom(<EstudosResumoView />);

    expect(document.body.textContent).toContain('1 reflexão');
    expect(document.body.textContent).toContain('2 reflexões');
    expect(document.body.textContent).not.toContain('reflexãoões');
  });

  it('exibe barra de atualização discreta e desabilita botões de período quando isFetching é true', () => {
    mockResumoResult = {
      ...mockResumoResult,
      isFetching: true,
    };

    renderDom(<EstudosResumoView />);

    const progressBar = document.querySelector('[role="progressbar"]');
    expect(progressBar).not.toBeNull();
    expect(progressBar?.getAttribute('aria-label')).toBe('Atualizando resultados');

    const presetLabels = ['Hoje', 'Ontem', 'Esta Semana', 'Semana Passada', 'Personalizado'];
    const buttons = Array.from(document.body.querySelectorAll('button')).filter((btn) =>
      presetLabels.includes(btn.textContent?.trim() ?? '')
    );
    expect(buttons.length).toBe(5);
    buttons.forEach((btn) => {
      expect(btn.hasAttribute('disabled')).toBe(true);
    });
  });
});
