// @vitest-environment happy-dom
import { act, type ReactElement } from 'react';
import type { CadernoErroDto } from '@shared/types/caderno-erros.types';
import type { SimuladoQuestaoDto } from '@shared/types/simulados.types';
import type { TemaDetalheDto, TemaListItemDto } from '@shared/types/temas.types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CadernoErroRowAccordion } from '@/features/caderno-erros/components/CadernoErroRowAccordion';
import { SimuladoQuestaoPosRow } from '@/features/simulados/components/SimuladoQuestaoPosRow';
import { TemaRowAccordion } from '@/features/temas-revisao/components/TemaRowAccordion';

const TEMA_ID_1 = '11111111-1111-4111-8111-111111111111';
const TEMA_ID_2 = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const SIMULADO_ID = '44444444-4444-4444-8444-444444444444';
const QUESTAO_ID = '55555555-5555-4555-8555-555555555555';
const ERRO_ID = '66666666-6666-4666-8666-666666666666';

const mockTemaDetalhe: TemaDetalheDto = {
  id: TEMA_ID_1,
  userId: USER_ID,
  nome: 'Programação Dinâmica',
  lastReviewedAt: '2026-11-10T10:00:00.000Z',
  lastReviewMode: 'SOLO',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z',
  reflexoesProprias: [
    {
      id: '77777777-7777-4777-8777-777777777777',
      userId: USER_ID,
      temaPrincipalId: TEMA_ID_1,
      temaPrincipal: {
        id: TEMA_ID_1,
        nome: 'Programação Dinâmica',
        lastReviewedAt: '2026-11-10T10:00:00.000Z',
        lastReviewMode: 'SOLO',
      },
      temasConectados: [],
      conteudo: 'Sempre definir estado base antes das transições.',
      createdAt: '2026-11-05T10:00:00.000Z',
      updatedAt: '2026-11-05T10:00:00.000Z',
    },
  ],
  conexoes: [
    {
      id: '88888888-8888-4888-8888-888888888888',
      userId: USER_ID,
      temaPrincipalId: TEMA_ID_1,
      temaPrincipal: {
        id: TEMA_ID_1,
        nome: 'Programação Dinâmica',
        lastReviewedAt: '2026-11-10T10:00:00.000Z',
        lastReviewMode: 'SOLO',
      },
      temasConectados: [
        {
          id: TEMA_ID_2,
          nome: 'Grafos DAG',
          lastReviewedAt: null,
          lastReviewMode: null,
        },
      ],
      conteudo: 'DP sobre DAG segue a ordenação topológica.',
      createdAt: '2026-11-06T10:00:00.000Z',
      updatedAt: '2026-11-06T10:00:00.000Z',
    },
  ],
  totalErrosPendentes: 2,
  totalErrosRevisados: 1,
};

const mockTemasOptionsData = {
  items: [
    {
      id: TEMA_ID_1,
      userId: USER_ID,
      nome: 'Programação Dinâmica',
      lastReviewedAt: null,
      lastReviewMode: null,
      totalReflexoes: 1,
      totalConexoes: 1,
      temasConectadosResumo: [],
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    },
  ],
  pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
};

const mockTemaDetailResult = {
  isPending: false,
  isError: false,
  data: mockTemaDetalhe,
  error: null,
  refetch: vi.fn(),
};

const mockTemasOptionsResult = {
  isPending: false,
  data: mockTemasOptionsData,
};

const mockMutationIdle = {
  isPending: false,
  mutateAsync: vi.fn(),
};

vi.mock('@/features/temas-revisao/hooks/useTemas', () => ({
  useTemaDetailQuery: () => mockTemaDetailResult,
  useTemasOptionsQuery: () => mockTemasOptionsResult,
  useCreateTemaMutation: () => mockMutationIdle,
}));

vi.mock('@/features/simulados/hooks/useSimulados', () => ({
  useClassificarQuestaoMutation: () => mockMutationIdle,
  useDeletePensamentoMutation: () => mockMutationIdle,
  useUpdatePensamentoMutation: () => mockMutationIdle,
}));

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

let mountContainer: HTMLDivElement | null = null;
let activeRoot: ReturnType<typeof createRoot> | null = null;
let activeQueryClient: QueryClient | null = null;

function cleanupDom(): void {
  if (activeRoot) {
    act(() => {
      activeRoot?.unmount();
    });
    activeRoot = null;
  }
  if (activeQueryClient) {
    activeQueryClient.clear();
    activeQueryClient = null;
  }
  mountContainer?.remove();
  mountContainer = null;
}

afterEach(() => {
  cleanupDom();
});

function renderWithProviders(element: ReactElement): HTMLDivElement {
  cleanupDom();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  activeQueryClient = queryClient;

  mountContainer = document.createElement('div');
  document.body.appendChild(mountContainer);
  activeRoot = createRoot(mountContainer);
  act(() => {
    activeRoot?.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{element}</MemoryRouter>
      </QueryClientProvider>
    );
  });
  return mountContainer;
}

describe('Gavetas de 2º nível com subseções colapsáveis sticky e recolher no rodapé', () => {
  it('CadernoErroRowAccordion usa overflow-x-clip, mantém subseções colapsáveis sticky e chama onToggleExpand no rodapé', () => {
    const onToggleExpand = vi.fn();

    const erroGeneric: CadernoErroDto = {
      id: ERRO_ID,
      userId: USER_ID,
      origem: 'GENERIC_FULL',
      status: 'PENDENTE',
      simuladoQuestaoId: null,
      codigoReferencia: null,
      titulo: 'Problema das Moedas',
      enunciadoCompleto: 'Dado um conjunto de moedas, conte combinações.',
      linkExterno: 'https://example.com/questao',
      observacaoErro: 'Faltou iterar moeda no laço externo.',
      lastReviewedAt: null,
      lastReviewMode: null,
      temas: [
        {
          id: TEMA_ID_1,
          nome: 'Programação Dinâmica',
          lastReviewedAt: null,
          lastReviewMode: null,
        },
      ],
      simuladoMeta: null,
      createdAt: '2026-11-10T10:00:00.000Z',
      updatedAt: '2026-11-10T10:00:00.000Z',
    };

    const container = renderWithProviders(
      <CadernoErroRowAccordion
        erro={erroGeneric}
        isExpanded={true}
        activeReviewMode={null}
        isDevolving={false}
        onToggleExpand={onToggleExpand}
        onRevisar={vi.fn()}
        onDevolver={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const outerArticle = container.querySelector('article');
    expect(outerArticle?.className).toContain('overflow-x-clip');
    expect(outerArticle?.className).not.toContain('overflow-hidden');

    const enunciadoSection = container.querySelector(
      'section[aria-label="Enunciado completo da questão"]'
    );
    expect(enunciadoSection).not.toBeNull();
    expect(enunciadoSection?.firstElementChild?.className).toContain('sticky');
    expect(enunciadoSection?.firstElementChild?.className).toContain('top-14');
    expect(enunciadoSection?.firstElementChild?.className).toContain('md:top-0');

    expect(container.textContent).toContain('Dado um conjunto de moedas');
    expect(container.textContent).toContain('Faltou iterar moeda');

    // Recolhe apenas Enunciado completo
    const toggleEnunciado = enunciadoSection?.querySelector(
      'button[aria-expanded]'
    ) as HTMLButtonElement | null;
    act(() => {
      toggleEnunciado?.click();
    });

    expect(container.textContent).not.toContain('Dado um conjunto de moedas');
    expect(container.textContent).toContain('Faltou iterar moeda');

    // Botão recolher do rodapé chama onToggleExpand(erro.id)
    const collapseFooterButton = Array.from(
      container.querySelectorAll('button')
    ).find((btn) => btn.textContent?.includes('Recolher detalhes'));
    expect(collapseFooterButton).toBeDefined();

    act(() => {
      collapseFooterButton?.click();
    });
    expect(onToggleExpand).toHaveBeenCalledWith(ERRO_ID);
  });

  it('CadernoErroRowAccordion origem SIMULADO torna Pensamentos colapsável mantendo cabeçalho da questão visível', () => {
    const erroSimulado: CadernoErroDto = {
      id: ERRO_ID,
      userId: USER_ID,
      origem: 'SIMULADO',
      status: 'PENDENTE',
      simuladoQuestaoId: QUESTAO_ID,
      codigoReferencia: null,
      titulo: 'P1 — Soma em Árvore',
      enunciadoCompleto: null,
      linkExterno: null,
      observacaoErro: 'Aplicar Euler Tour.',
      lastReviewedAt: null,
      lastReviewMode: null,
      temas: [],
      simuladoMeta: {
        simuladoId: SIMULADO_ID,
        simuladoTitulo: 'OBI Fase 3',
        simuladoQuestaoId: QUESTAO_ID,
        numeroQuestao: 'P1',
        tituloQuestao: 'Soma em Árvore',
        resultado: 'ERREI',
        pensamentos: [
          {
            id: '99999999-9999-4999-8999-999999999999',
            userId: USER_ID,
            simuladoQuestaoId: QUESTAO_ID,
            descricao: 'Tentei DFS quadrática primeiro.',
            tempoDecorridoSegundos: 600,
            createdAt: '2026-11-10T10:10:00.000Z',
            updatedAt: '2026-11-10T10:10:00.000Z',
          },
        ],
      },
      createdAt: '2026-11-10T10:00:00.000Z',
      updatedAt: '2026-11-10T10:00:00.000Z',
    };

    const container = renderWithProviders(
      <CadernoErroRowAccordion
        erro={erroSimulado}
        isExpanded={true}
        activeReviewMode={null}
        isDevolving={false}
        onToggleExpand={vi.fn()}
        onRevisar={vi.fn()}
        onDevolver={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const thoughtsSection = container.querySelector(
      'section[aria-label="Pensamentos durante a prova"]'
    );
    expect(thoughtsSection).not.toBeNull();
    expect(thoughtsSection?.firstElementChild?.className).toContain('sticky');
    expect(container.textContent).toContain('Tentei DFS quadrática primeiro.');
    expect(container.textContent).toContain('OBI Fase 3');

    const toggleThoughts = thoughtsSection?.querySelector(
      'button[aria-expanded]'
    ) as HTMLButtonElement | null;
    act(() => {
      toggleThoughts?.click();
    });

    expect(container.textContent).not.toContain(
      'Tentei DFS quadrática primeiro.'
    );
    expect(container.textContent).toContain('OBI Fase 3');
  });

  it('TemaRowAccordion usa overflow-x-clip, renderiza cabeçalhos sticky em ambas colunas e botão Recolher tema no rodapé', () => {
    const onToggleExpand = vi.fn();
    const tema: TemaListItemDto = {
      id: TEMA_ID_1,
      userId: USER_ID,
      nome: 'Programação Dinâmica',
      lastReviewedAt: '2026-11-10T10:00:00.000Z',
      lastReviewMode: 'SOLO',
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-10T10:00:00.000Z',
      totalReflexoes: 1,
      totalConexoes: 1,
      temasConectadosResumo: [
        {
          id: TEMA_ID_2,
          nome: 'Grafos DAG',
          lastReviewedAt: null,
          lastReviewMode: null,
        },
      ],
    };

    const container = renderWithProviders(
      <TemaRowAccordion
        tema={tema}
        isExpanded={true}
        onToggleExpand={onToggleExpand}
        onPraticar={vi.fn()}
        onEditTema={vi.fn()}
        onDeleteTema={vi.fn()}
        onAddReflexao={vi.fn()}
        onAddConexao={vi.fn()}
        onEditReflexao={vi.fn()}
        onDeleteReflexao={vi.fn()}
        onNavigateToTema={vi.fn()}
      />
    );

    const outerArticle = container.querySelector('article');
    expect(outerArticle?.className).toContain('overflow-x-clip');
    expect(outerArticle?.className).not.toContain('overflow-hidden');

    const reflexoesSection = container.querySelector(
      'section[aria-label="Reflexões Próprias"]'
    );
    const conexoesSection = container.querySelector(
      'section[aria-label="Conexões com Outros Temas"]'
    );

    expect(reflexoesSection?.firstElementChild?.className).toContain('sticky');
    expect(conexoesSection?.firstElementChild?.className).toContain('sticky');
    expect(container.textContent).toContain(
      'Sempre definir estado base antes das transições.'
    );
    expect(container.textContent).toContain(
      'DP sobre DAG segue a ordenação topológica.'
    );

    // Recolhe apenas Reflexões Próprias
    const toggleReflexoes = reflexoesSection?.querySelector(
      'button[aria-expanded]'
    ) as HTMLButtonElement | null;
    act(() => {
      toggleReflexoes?.click();
    });

    expect(container.textContent).not.toContain(
      'Sempre definir estado base antes das transições.'
    );
    expect(container.textContent).toContain(
      'DP sobre DAG segue a ordenação topológica.'
    );

    // Botão Recolher tema no rodapé
    const collapseButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Recolher tema')
    );
    expect(collapseButton).toBeDefined();

    act(() => {
      collapseButton?.click();
    });
    expect(onToggleExpand).toHaveBeenCalledWith(TEMA_ID_1);
  });

  it('SimuladoQuestaoPosRow torna apenas Pensamentos da prova sticky/colapsável e recolhe questão no rodapé', () => {
    const onToggleExpand = vi.fn();
    const questao: SimuladoQuestaoDto = {
      id: QUESTAO_ID,
      userId: USER_ID,
      simuladoId: SIMULADO_ID,
      numeroQuestao: 'Q1',
      tituloQuestao: 'Caminho Mínimo',
      ordem: 1,
      resultado: 'PARCIAL',
      observacaoPosRevisao: 'Faltou tratar pesos nulos com 0-1 BFS.',
      temas: [
        {
          id: TEMA_ID_1,
          nome: 'Programação Dinâmica',
          lastReviewedAt: null,
          lastReviewMode: null,
        },
      ],
      pensamentos: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          userId: USER_ID,
          simuladoQuestaoId: QUESTAO_ID,
          descricao: 'Suspeitei de Dijkstra logo no início.',
          tempoDecorridoSegundos: 185,
          createdAt: '2026-11-10T10:03:05.000Z',
          updatedAt: '2026-11-10T10:03:05.000Z',
        },
      ],
      createdAt: '2026-11-10T10:00:00.000Z',
      updatedAt: '2026-11-10T10:00:00.000Z',
    };

    const container = renderWithProviders(
      <SimuladoQuestaoPosRow
        simuladoId={SIMULADO_ID}
        questao={questao}
        questoesList={[questao]}
        isExpanded={true}
        onToggleExpand={onToggleExpand}
        onEnsureExpanded={vi.fn()}
      />
    );

    const outerArticle = container.querySelector('article');
    expect(outerArticle?.className).toContain('overflow-x-clip');
    expect(outerArticle?.className).not.toContain('overflow-hidden');

    // Coluna esquerda não deve ser colapsável nem ter header sticky concorrente
    const leftSection = container.querySelector(
      'section[aria-label="Temas e pós-revisão da questão"]'
    );
    expect(leftSection).not.toBeNull();
    expect(leftSection?.querySelector('button[aria-expanded]')).toBeNull();

    // Coluna direita deve ter header sticky e toggle
    const rightSection = container.querySelector(
      'section[aria-label="Pensamentos registrados durante a prova"]'
    );
    expect(rightSection?.firstElementChild?.className).toContain('sticky');
    expect(container.textContent).toContain(
      'Suspeitei de Dijkstra logo no início.'
    );

    const togglePensamentos = rightSection?.querySelector(
      'button[aria-expanded]'
    ) as HTMLButtonElement | null;
    act(() => {
      togglePensamentos?.click();
    });
    expect(container.textContent).not.toContain(
      'Suspeitei de Dijkstra logo no início.'
    );

    const collapseQuestionBtn = Array.from(
      container.querySelectorAll('button')
    ).find((btn) => btn.textContent?.includes('Recolher questão'));
    expect(collapseQuestionBtn).toBeDefined();

    act(() => {
      collapseQuestionBtn?.click();
    });
    expect(onToggleExpand).toHaveBeenCalledWith(QUESTAO_ID);
  });
});
