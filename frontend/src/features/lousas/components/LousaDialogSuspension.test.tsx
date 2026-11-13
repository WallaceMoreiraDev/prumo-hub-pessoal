// @vitest-environment happy-dom
import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { CadernoErroDto } from '@shared/types/caderno-erros.types';
import type { LousaDto } from '@shared/types/lousas.types';
import type {
  ReflexaoDto,
  TemaListItemDto,
  TemaSummaryDto,
} from '@shared/types/temas.types';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { CadernoErroFormDialog } from '@/features/caderno-erros/components/CadernoErroFormDialog';
import { ReflexaoFormDialog } from '@/features/temas-revisao/components/ReflexaoFormDialog';

const TEMA_GRAFOS_SUMMARY: TemaSummaryDto = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Grafos',
  lastReviewedAt: null,
  lastReviewMode: null,
};

const TEMA_DP_SUMMARY: TemaSummaryDto = {
  id: '22222222-2222-4222-8222-222222222222',
  nome: 'Programação Dinâmica',
  lastReviewedAt: null,
  lastReviewMode: null,
};

const TEMA_OPTIONS_ITEMS: TemaListItemDto[] = [
  {
    ...TEMA_GRAFOS_SUMMARY,
    userId: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    totalReflexoes: 0,
    totalConexoes: 0,
    temasConectadosResumo: [],
  },
  {
    ...TEMA_DP_SUMMARY,
    userId: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    totalReflexoes: 0,
    totalConexoes: 0,
    temasConectadosResumo: [],
  },
];

const STABLE_TEMAS_OPTIONS_QUERY = {
  data: {
    items: TEMA_OPTIONS_ITEMS,
    pagination: {
      page: 1,
      limit: 100,
      total: TEMA_OPTIONS_ITEMS.length,
      totalPages: 1,
    },
  },
  isLoading: false,
  isFetching: false,
};

const STABLE_IDLE_MUTATION = {
  isPending: false,
  mutateAsync: vi.fn(async () => undefined),
};

const MOCK_LOUSA_COUNTER = { current: 0 };

function createMockLousaDto(id?: string): LousaDto {
  MOCK_LOUSA_COUNTER.current += 1;
  const resolvedId =
    id ?? `33333333-3333-4333-8333-33333333333${MOCK_LOUSA_COUNTER.current}`;
  return {
    id: resolvedId,
    userId: 'user-1',
    previewMimeType: 'image/png',
    sceneSizeBytes: 512,
    previewSizeBytes: 1024,
    totalSizeBytes: 1536,
    previewSignedUrl: 'data:image/png;base64,iVBORw0KGgo=',
    sceneSignedUrl: null,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
}

vi.mock('@/features/temas-revisao/hooks/useTemas', () => ({
  useTemasOptionsQuery: () => STABLE_TEMAS_OPTIONS_QUERY,
  useCreateTemaMutation: () => STABLE_IDLE_MUTATION,
  useCreateReflexaoMutation: () => STABLE_IDLE_MUTATION,
  useUpdateReflexaoMutation: () => STABLE_IDLE_MUTATION,
}));

vi.mock('@/features/caderno-erros/hooks/useCadernoErros', () => ({
  useCreateCadernoErroMutation: () => STABLE_IDLE_MUTATION,
  useUpdateCadernoErroMutation: () => STABLE_IDLE_MUTATION,
}));

vi.mock('@/features/lousas/api/lousasApi', () => ({
  lousasApi: {
    deleteLousa: vi.fn(async () => undefined),
    getLousaUrls: vi.fn(async () => ({
      previewSignedUrl: 'data:image/png;base64,iVBORw0KGgo=',
      sceneSignedUrl: null,
      expiresInSeconds: 3600,
    })),
  },
}));

vi.mock('@/features/lousas/components/LousaCanvasModal', () => ({
  LousaCanvasModal: ({
    open,
    onOpenChange,
    lousaId,
    title,
    onSaved,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lousaId?: string | null;
    title?: string;
    onSaved: (savedLousa: LousaDto) => void;
  }) => {
    if (!open) {
      return null;
    }

    return (
      <div
        data-testid="mock-lousa-canvas-modal"
        data-lousa-id={lousaId ?? ''}
        aria-label={title ?? 'Lousa'}
      >
        <button
          type="button"
          data-testid="mock-lousa-save"
          onClick={() => {
            onSaved(createMockLousaDto(lousaId ?? undefined));
          }}
        >
          Salvar lousa mock
        </button>
        <button
          type="button"
          data-testid="mock-lousa-close"
          onClick={() => onOpenChange(false)}
        >
          Fechar lousa mock
        </button>
      </div>
    );
  },
}));

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

let mountContainer: HTMLDivElement | null = null;
let activeRoot: ReturnType<typeof createRoot> | null = null;

beforeEach(() => {
  MOCK_LOUSA_COUNTER.current = 0;
});

afterEach(async () => {
  if (activeRoot) {
    await act(async () => {
      activeRoot?.unmount();
      await Promise.resolve();
    });
    activeRoot = null;
  }
  mountContainer?.remove();
  mountContainer = null;
  document.body.innerHTML = '';
});

async function renderDom(element: ReactElement): Promise<void> {
  mountContainer = document.createElement('div');
  document.body.appendChild(mountContainer);
  activeRoot = createRoot(mountContainer);
  await act(async () => {
    activeRoot?.render(element);
    await Promise.resolve();
  });
}

async function setControlValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): Promise<void> {
  const proto =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  await act(async () => {
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
  });
}

function findButtonByText(text: string): HTMLButtonElement {
  const buttons = Array.from(document.body.querySelectorAll('button'));
  const match = buttons.find((button) =>
    button.textContent?.includes(text)
  );
  if (!match) {
    throw new Error(`Botão não encontrado com texto "${text}".`);
  }
  return match;
}

describe('Suspensão de Radix Dialog ao abrir LousaCanvasModal', () => {
  it('suspende ReflexaoFormDialog na criação, abre a lousa fora do Dialog e preserva texto e tema ao retornar', async () => {
    await renderDom(
      <ReflexaoFormDialog
        open
        onOpenChange={() => undefined}
        defaultTemaPrincipal={TEMA_GRAFOS_SUMMARY}
      />
    );

    expect(document.body.textContent).toContain('Nova Reflexão');

    const textarea = document.body.querySelector(
      '#reflexao-conteudo'
    ) as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    if (!textarea) {
      return;
    }

    await setControlValue(
      textarea,
      'Rascunho importante sobre BFS em grafo bipartido'
    );

    const openLousaButton = findButtonByText('Desenhar na lousa');
    await act(async () => {
      openLousaButton.click();
      await Promise.resolve();
    });

    // Dialog pai precisa estar suspenso (fora do DOM) enquanto LousaCanvasModal está aberto
    expect(document.body.textContent).not.toContain('Nova Reflexão');
    const mockCanvas = document.body.querySelector(
      '[data-testid="mock-lousa-canvas-modal"]'
    );
    expect(mockCanvas).not.toBeNull();
    expect(mockCanvas?.closest('[role="dialog"]')).toBeNull();

    const saveMockButton = document.body.querySelector(
      '[data-testid="mock-lousa-save"]'
    ) as HTMLButtonElement | null;
    expect(saveMockButton).not.toBeNull();
    await act(async () => {
      saveMockButton?.click();
      await Promise.resolve();
    });

    // Ao salvar a lousa, Dialog pai retoma com texto, tema principal e preview anexado
    expect(
      document.body.querySelector('[data-testid="mock-lousa-canvas-modal"]')
    ).toBeNull();
    expect(document.body.textContent).toContain('Nova Reflexão');

    const resumedTextarea = document.body.querySelector(
      '#reflexao-conteudo'
    ) as HTMLTextAreaElement | null;
    expect(resumedTextarea?.value).toBe(
      'Rascunho importante sobre BFS em grafo bipartido'
    );
    expect(document.body.textContent).toContain('Grafos');
    expect(document.body.textContent).toContain('Editar na lousa');
    expect(document.body.textContent).toContain('Remover lousa');
  });

  it('preserva alterações não salvas no ReflexaoFormDialog em modo de edição ao abrir e salvar a lousa', async () => {
    const editingReflexao: ReflexaoDto = {
      id: '44444444-4444-4444-8444-444444444444',
      userId: 'user-1',
      temaPrincipalId: TEMA_GRAFOS_SUMMARY.id,
      temaPrincipal: TEMA_GRAFOS_SUMMARY,
      temasConectados: [TEMA_DP_SUMMARY],
      conteudo: 'Conteúdo original salvo no banco',
      lousaId: null,
      lousa: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    await renderDom(
      <ReflexaoFormDialog
        open
        onOpenChange={() => undefined}
        editingReflexao={editingReflexao}
      />
    );

    const textarea = document.body.querySelector(
      '#reflexao-conteudo'
    ) as HTMLTextAreaElement | null;
    expect(textarea?.value).toBe('Conteúdo original salvo no banco');
    if (!textarea) {
      return;
    }

    await setControlValue(textarea, 'Conteúdo editado antes da lousa');

    await act(async () => {
      findButtonByText('Desenhar na lousa').click();
      await Promise.resolve();
    });

    expect(document.body.textContent).not.toContain('Editar Reflexão / Conexão');

    await act(async () => {
      (
        document.body.querySelector(
          '[data-testid="mock-lousa-save"]'
        ) as HTMLButtonElement | null
      )?.click();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('Editar Reflexão / Conexão');
    const resumedTextarea = document.body.querySelector(
      '#reflexao-conteudo'
    ) as HTMLTextAreaElement | null;
    expect(resumedTextarea?.value).toBe('Conteúdo editado antes da lousa');
    expect(document.body.textContent).toContain('Programação Dinâmica');
    expect(document.body.textContent).toContain('Editar na lousa');
  });

  it('suspende CadernoErroFormDialog na criação (EXTERNAL_LINK) e preserva campos e tema ao retornar da lousa', async () => {
    await renderDom(
      <CadernoErroFormDialog
        open
        onOpenChange={() => undefined}
        defaultTema={TEMA_GRAFOS_SUMMARY}
      />
    );

    const codigoInput = document.body.querySelector(
      '#erro-codigo-referencia'
    ) as HTMLInputElement | null;
    const linkInput = document.body.querySelector(
      '#erro-external-link'
    ) as HTMLInputElement | null;
    const obsTextarea = document.body.querySelector(
      '#erro-external-observacao'
    ) as HTMLTextAreaElement | null;

    expect(codigoInput).not.toBeNull();
    expect(linkInput).not.toBeNull();
    expect(obsTextarea).not.toBeNull();
    if (!codigoInput || !linkInput || !obsTextarea) {
      return;
    }

    await setControlValue(codigoInput, 'CF 1900C');
    await setControlValue(
      linkInput,
      'https://codeforces.com/problemset/problem/1900/C'
    );
    await setControlValue(obsTextarea, 'Esqueci de validar folha na árvore');

    await act(async () => {
      findButtonByText('Desenhar na lousa').click();
      await Promise.resolve();
    });

    expect(document.body.textContent).not.toContain('Registrar Erro Manual');
    expect(
      document.body.querySelector('[data-testid="mock-lousa-canvas-modal"]')
    ).not.toBeNull();

    await act(async () => {
      (
        document.body.querySelector(
          '[data-testid="mock-lousa-save"]'
        ) as HTMLButtonElement | null
      )?.click();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('Registrar Erro Manual');
    expect(
      (
        document.body.querySelector(
          '#erro-codigo-referencia'
        ) as HTMLInputElement | null
      )?.value
    ).toBe('CF 1900C');
    expect(
      (
        document.body.querySelector(
          '#erro-external-link'
        ) as HTMLInputElement | null
      )?.value
    ).toBe('https://codeforces.com/problemset/problem/1900/C');
    expect(
      (
        document.body.querySelector(
          '#erro-external-observacao'
        ) as HTMLTextAreaElement | null
      )?.value
    ).toBe('Esqueci de validar folha na árvore');
    expect(document.body.textContent).toContain('Grafos');
    expect(document.body.textContent).toContain('Editar na lousa');
    expect(document.body.textContent).toContain('Remover lousa');
  });

  it('preserva rascunho não salvo em edição de SimuladoEditSubform e GenericFullSubform após salvar lousa', async () => {
    const simuladoErro: CadernoErroDto = {
      id: '55555555-5555-4555-8555-555555555555',
      userId: 'user-1',
      origem: 'SIMULADO',
      status: 'PENDENTE',
      simuladoQuestaoId: '66666666-6666-4666-8666-666666666666',
      codigoReferencia: null,
      titulo: 'Questão 3 - Árvore Geradora Mínima',
      enunciadoCompleto: null,
      linkExterno: null,
      observacaoErro: 'Observação original simulado',
      lousaId: null,
      lousa: null,
      lastReviewedAt: null,
      lastReviewMode: null,
      temas: [TEMA_GRAFOS_SUMMARY],
      simuladoMeta: {
        simuladoId: '77777777-7777-4777-8777-777777777777',
        simuladoTitulo: 'Simulado OBI',
        simuladoQuestaoId: '66666666-6666-4666-8666-666666666666',
        numeroQuestao: 'Q3',
        tituloQuestao: 'Árvore Geradora Mínima',
        resultado: 'ERREI',
        pensamentos: [],
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    await renderDom(
      <CadernoErroFormDialog
        open
        onOpenChange={() => undefined}
        editingErro={simuladoErro}
      />
    );

    const simuladoObs = document.body.querySelector(
      '#erro-simulado-observacao'
    ) as HTMLTextAreaElement | null;
    expect(simuladoObs?.value).toBe('Observação original simulado');
    if (!simuladoObs) {
      return;
    }

    await setControlValue(simuladoObs, 'Observação editada no simulado');

    await act(async () => {
      findButtonByText('Desenhar na lousa').click();
      await Promise.resolve();
    });

    expect(document.body.textContent).not.toContain(
      'Editar Registro do Caderno de Erros'
    );

    await act(async () => {
      (
        document.body.querySelector(
          '[data-testid="mock-lousa-save"]'
        ) as HTMLButtonElement | null
      )?.click();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain(
      'Editar Registro do Caderno de Erros'
    );
    expect(
      (
        document.body.querySelector(
          '#erro-simulado-observacao'
        ) as HTMLTextAreaElement | null
      )?.value
    ).toBe('Observação editada no simulado');
    expect(document.body.textContent).toContain('Grafos');
    expect(document.body.textContent).toContain('Editar na lousa');

    // Troca para edição GENERIC_FULL e valida preservação de título editado
    await act(async () => {
      activeRoot?.unmount();
      await Promise.resolve();
    });
    activeRoot = null;
    mountContainer?.remove();
    mountContainer = null;

    const genericErro: CadernoErroDto = {
      id: '88888888-8888-4888-8888-888888888888',
      userId: 'user-1',
      origem: 'GENERIC_FULL',
      status: 'PENDENTE',
      simuladoQuestaoId: null,
      codigoReferencia: null,
      titulo: 'Título original completo',
      enunciadoCompleto: 'Enunciado original completo da questão.',
      linkExterno: null,
      observacaoErro: 'Nota original',
      lousaId: null,
      lousa: null,
      lastReviewedAt: null,
      lastReviewMode: null,
      temas: [TEMA_GRAFOS_SUMMARY],
      simuladoMeta: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    await renderDom(
      <CadernoErroFormDialog
        open
        onOpenChange={() => undefined}
        editingErro={genericErro}
      />
    );

    const genericTitulo = document.body.querySelector(
      '#erro-generic-titulo'
    ) as HTMLInputElement | null;
    expect(genericTitulo?.value).toBe('Título original completo');
    if (!genericTitulo) {
      return;
    }

    await setControlValue(genericTitulo, 'Título editado antes da lousa');

    await act(async () => {
      findButtonByText('Desenhar na lousa').click();
      await Promise.resolve();
    });

    await act(async () => {
      (
        document.body.querySelector(
          '[data-testid="mock-lousa-save"]'
        ) as HTMLButtonElement | null
      )?.click();
      await Promise.resolve();
    });

    expect(
      (
        document.body.querySelector(
          '#erro-generic-titulo'
        ) as HTMLInputElement | null
      )?.value
    ).toBe('Título editado antes da lousa');
    expect(document.body.textContent).toContain('Editar na lousa');
  });
});
