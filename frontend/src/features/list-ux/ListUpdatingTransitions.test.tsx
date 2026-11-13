// @vitest-environment happy-dom
import { act, type ReactElement } from 'react';
import type { CadernoErroDto } from '@shared/types/caderno-erros.types';
import type { SimuladoListItemDto } from '@shared/types/simulados.types';
import type { TemaListItemDto } from '@shared/types/temas.types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CadernoErrosPage } from '@/features/caderno-erros/CadernoErrosPage';
import { SimuladosPage } from '@/features/simulados/SimuladosPage';
import { TemasRevisaoPage } from '@/features/temas-revisao/TemasRevisaoPage';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TEMA_ID = '22222222-2222-4222-8222-222222222222';
const SIMULADO_ID = '33333333-3333-4333-8333-333333333333';
const ERRO_ID = '44444444-4444-4444-8444-444444444444';

interface MockListQueryState<T> {
  isPending: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
  isError: boolean;
  error: unknown;
  data:
    | {
        items: T[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }
    | undefined;
  refetch: () => Promise<void>;
}

const sampleSimulado: SimuladoListItemDto = {
  id: SIMULADO_ID,
  userId: USER_ID,
  titulo: 'Simulado OBI Nacional',
  duracaoConfiguradaSegundos: 14400,
  tempoGastoSegundos: 3600,
  pdfStoragePath: null,
  hasPdf: false,
  status: 'FINALIZADO',
  startedAt: '2026-11-01T10:00:00.000Z',
  finishedAt: '2026-11-01T11:00:00.000Z',
  createdAt: '2026-11-01T09:00:00.000Z',
  updatedAt: '2026-11-01T11:00:00.000Z',
  totalQuestoes: 3,
  totalQuestoesClassificadas: 3,
  totalAcertos: 2,
  totalParciais: 1,
  totalErros: 0,
  totalPensamentos: 2,
};

const sampleTema: TemaListItemDto = {
  id: TEMA_ID,
  userId: USER_ID,
  nome: 'Grafos',
  lastReviewedAt: '2026-11-05T10:00:00.000Z',
  lastReviewMode: 'SOLO',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-05T10:00:00.000Z',
  totalReflexoes: 1,
  totalConexoes: 0,
  temasConectadosResumo: [],
};

const sampleErro: CadernoErroDto = {
  id: ERRO_ID,
  userId: USER_ID,
  origem: 'GENERIC_FULL',
  status: 'PENDENTE',
  simuladoQuestaoId: null,
  codigoReferencia: null,
  titulo: 'Erro em Grafos',
  enunciadoCompleto: 'Enunciado teste',
  linkExterno: null,
  observacaoErro: null,
  lastReviewedAt: null,
  lastReviewMode: null,
  temas: [],
  simuladoMeta: null,
  lousaId: null,
  lousa: null,
  createdAt: '2026-11-05T10:00:00.000Z',
  updatedAt: '2026-11-05T10:00:00.000Z',
};

let mockSimuladosState: MockListQueryState<SimuladoListItemDto>;
let mockTemasState: MockListQueryState<TemaListItemDto>;
let mockErrosState: MockListQueryState<CadernoErroDto>;

const mockTemasOptionsResult = {
  isPending: false,
  data: {
    items: [sampleTema],
    pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
  },
};

const mockTemaDetailIdle = {
  isPending: false,
  isError: false,
  data: undefined,
  error: null,
  refetch: vi.fn(),
};

const mockMutationIdle = {
  isPending: false,
  mutateAsync: vi.fn(),
};

vi.mock('@/features/simulados/hooks/useSimulados', () => ({
  useSimuladosListQuery: () => mockSimuladosState,
  useCreateSimuladoMutation: () => mockMutationIdle,
  useDeleteSimuladoMutation: () => mockMutationIdle,
}));

vi.mock('@/features/temas-revisao/hooks/useTemas', () => ({
  useTemasListQuery: () => mockTemasState,
  useTemasOptionsQuery: () => mockTemasOptionsResult,
  useTemaDetailQuery: () => mockTemaDetailIdle,
  useCreateTemaMutation: () => mockMutationIdle,
  useUpdateTemaMutation: () => mockMutationIdle,
  useDeleteTemaMutation: () => mockMutationIdle,
  useRegistrarPraticaMutation: () => mockMutationIdle,
  useCreateReflexaoMutation: () => mockMutationIdle,
  useUpdateReflexaoMutation: () => mockMutationIdle,
  useDeleteReflexaoMutation: () => mockMutationIdle,
}));

vi.mock('@/features/caderno-erros/hooks/useCadernoErros', () => ({
  useCadernoErrosListQuery: () => mockErrosState,
  useCadernoErroDetailQuery: () => mockTemaDetailIdle,
  useCreateCadernoErroMutation: () => mockMutationIdle,
  useUpdateCadernoErroMutation: () => mockMutationIdle,
  useRevisarCadernoErroMutation: () => mockMutationIdle,
  useDevolverCadernoErroMutation: () => mockMutationIdle,
  useDeleteCadernoErroMutation: () => mockMutationIdle,
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

beforeEach(() => {
  mockSimuladosState = {
    isPending: false,
    isFetching: false,
    isPlaceholderData: false,
    isError: false,
    error: null,
    data: {
      items: [sampleSimulado],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 2 },
    },
    refetch: vi.fn(),
  };

  mockTemasState = {
    isPending: false,
    isFetching: false,
    isPlaceholderData: false,
    isError: false,
    error: null,
    data: {
      items: [sampleTema],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 2 },
    },
    refetch: vi.fn(),
  };

  mockErrosState = {
    isPending: false,
    isFetching: false,
    isPlaceholderData: false,
    isError: false,
    error: null,
    data: {
      items: [sampleErro],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 2 },
    },
    refetch: vi.fn(),
  };
});

afterEach(() => {
  cleanupDom();
});

function renderPage(element: ReactElement): HTMLDivElement {
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

function typeIntoInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('Feedback imediato e transição suave nas 3 páginas de listagem', () => {
  it('exibe skeleton (não empty-state falso) quando isPlaceholderData=true e items está vazio nas 3 páginas', () => {
    mockErrosState.isFetching = true;
    mockErrosState.isPlaceholderData = true;
    mockErrosState.data = {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };

    const errosContainer = renderPage(<CadernoErrosPage />);
    expect(errosContainer.textContent).not.toContain(
      'Nenhum erro pendente no momento'
    );
    expect(errosContainer.textContent).toContain('Atualizando resultados');
    expect(errosContainer.querySelector('[aria-busy="true"]')).not.toBeNull();

    mockTemasState.isFetching = true;
    mockTemasState.isPlaceholderData = true;
    mockTemasState.data = {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };

    const temasContainer = renderPage(<TemasRevisaoPage />);
    expect(temasContainer.textContent).not.toContain(
      'Nenhum tema cadastrado ainda'
    );
    expect(temasContainer.textContent).toContain('Atualizando resultados');
    expect(temasContainer.querySelector('[aria-busy="true"]')).not.toBeNull();

    mockSimuladosState.isFetching = true;
    mockSimuladosState.isPlaceholderData = true;
    mockSimuladosState.data = {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };

    const simuladosContainer = renderPage(<SimuladosPage />);
    expect(simuladosContainer.textContent).not.toContain(
      'Nenhum simulado cadastrado ainda'
    );
    expect(simuladosContainer.textContent).toContain('Atualizando resultados');
    expect(
      simuladosContainer.querySelector('[aria-busy="true"]')
    ).not.toBeNull();
  });

  it('aplica transição suave (opacity-55, pointer-events-none, aria-busy) e barra/status ao usar placeholderData com itens', () => {
    mockSimuladosState.isFetching = true;
    mockSimuladosState.isPlaceholderData = true;

    const container = renderPage(<SimuladosPage />);
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(container.textContent).toContain('Atualizando resultados');

    const busyWrapper = Array.from(
      container.querySelectorAll('[aria-busy="true"]')
    ).find((el) => el.className.includes('opacity-55'));
    expect(busyWrapper).toBeDefined();
    expect(busyWrapper?.className).toContain('pointer-events-none');
    expect(busyWrapper?.className).toContain('transition-opacity');

    const nextPageButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Próxima')
    );
    expect(nextPageButton?.disabled).toBe(true);
  });

  it('reage instantaneamente ao digitar na busca antes mesmo do debounce terminar', () => {
    const container = renderPage(<TemasRevisaoPage />);
    expect(container.querySelector('[role="progressbar"]')).toBeNull();

    const searchInput = container.querySelector(
      'input[aria-label="Buscar tema pelo nome"]'
    ) as HTMLInputElement | null;
    expect(searchInput).not.toBeNull();
    if (!searchInput) {
      return;
    }

    typeIntoInput(searchInput, 'Grafos');

    // Imediatamente após digitar, isSearchPending ativa todos os indicadores visuais
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="search-updating-spinner"]')
    ).not.toBeNull();
    expect(container.textContent).toContain('Atualizando resultados');

    const dimmedList = Array.from(
      container.querySelectorAll('[aria-busy="true"]')
    ).find((el) => el.className.includes('opacity-55'));
    expect(dimmedList).toBeDefined();
  });
});
