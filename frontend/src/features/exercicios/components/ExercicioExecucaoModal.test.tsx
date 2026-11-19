// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import type { ExercicioAvulsoDetalheDto } from '@shared/types/exercicios.types';
import type { TemaListItemDto, TemaSummaryDto } from '@shared/types/temas.types';
import { afterEach, describe, expect, it, vi } from 'vitest';

const TEMA_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEMA_MOCK: TemaSummaryDto = {
  id: TEMA_ID,
  nome: 'Grafos e DFS',
  lastReviewedAt: null,
  lastReviewMode: null,
};

const EDITING_MOCK: ExercicioAvulsoDetalheDto = {
  id: 'ex-123',
  titulo: 'Exercício Existente de Grafos',
  duracaoSegundos: 1200,
  desfecho: 'SOLO',
  temas: [TEMA_MOCK],
  lousa: null,
  enunciado: 'Enunciado detalhado do problema',
  linkExterno: 'https://codeforces.com/problem/123',
  observacao: 'Anotações da resolução',
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
};

const TEMA_ITEM_MOCK: TemaListItemDto = {
  ...TEMA_MOCK,
  userId: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  totalReflexoes: 0,
  totalConexoes: 0,
  temasConectadosResumo: [],
};

const STABLE_TEMAS_OPTIONS_QUERY = {
  data: {
    items: [TEMA_ITEM_MOCK],
    pagination: {
      page: 1,
      limit: 100,
      total: 1,
      totalPages: 1,
    },
  },
  isLoading: false,
  isFetching: false,
};

const STABLE_MUTATION = {
  mutateAsync: vi.fn(async () => undefined),
  isPending: false,
};

vi.mock('@/features/exercicios/hooks/useExercicios', () => ({
  useCreateExercicioMutation: () => STABLE_MUTATION,
  useUpdateExercicioMutation: () => STABLE_MUTATION,
}));

vi.mock('@/features/temas-revisao/hooks/useTemas', () => ({
  useTemasOptionsQuery: () => STABLE_TEMAS_OPTIONS_QUERY,
  useCreateTemaMutation: () => STABLE_MUTATION,
  temasKeys: { all: ['temas'] },
}));

vi.mock('@/features/lousas/api/lousasApi', () => ({
  lousasApi: {
    deleteLousa: vi.fn(async () => ({ id: 'lousa-1' })),
  },
}));

vi.mock('@/components/markdown/MarkdownMathRenderer', () => ({
  MarkdownMathRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock('@/features/lousas/components/LousaCanvasModal', () => ({
  LousaCanvasModal: () => null,
}));

import { ExercicioExecucaoModal } from '@/features/exercicios/components/ExercicioExecucaoModal';

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

describe('ExercicioExecucaoModal', () => {
  it('renderiza o modal aberto com cronômetro, campos e botões de desfecho', () => {
    renderDom(
      <ExercicioExecucaoModal
        open={true}
        onOpenChange={vi.fn()}
        initialTemas={[TEMA_MOCK]}
        defaultTemaIds={[TEMA_ID]}
      />
    );

    expect(document.body.textContent).toContain('Sessão de Exercício Avulso');
    expect(document.body.textContent).toContain('Tempo Dedicado');
    expect(document.body.textContent).toContain('Resolvi Sozinho (Solo)');
    expect(document.body.textContent).toContain('Resolvi com Ajuda (Help)');
  });

  it('abre em modo de edição com tempo acumulado hidratado e cronômetro pausado', () => {
    renderDom(
      <ExercicioExecucaoModal
        open={true}
        onOpenChange={vi.fn()}
        editingExercicio={EDITING_MOCK}
      />
    );

    expect(document.body.textContent).toContain('Editar Exercício de Estudo');
    expect(document.body.textContent).toContain('20:00');
    expect(document.body.textContent).toContain('Retomar');
    expect(document.body.textContent).not.toContain('Pausar');

    const tituloInput = document.querySelector('input[name="titulo"]') as HTMLInputElement | null;
    expect(tituloInput?.value).toBe('Exercício Existente de Grafos');
  });
});
