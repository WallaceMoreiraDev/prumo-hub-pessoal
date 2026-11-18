// @vitest-environment happy-dom
import {
  act,
  forwardRef,
  useImperativeHandle,
  type ReactElement,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { LousaCanvasModal } from '@/features/lousas/components/LousaCanvasModal';
import type {
  LousaExcalidrawCanvasHandle,
  LousaLiveStatus,
  LousaStructureInput,
} from '@/features/lousas/components/LousaExcalidrawCanvas';

const STABLE_IDLE_MUTATION = {
  isPending: false,
  mutateAsync: vi.fn(async () => undefined),
};

const MOCK_CANVAS_HANDLE_SPIES = {
  insertStructure: vi.fn(
    (
      structure: LousaStructureInput,
      _options?: { selectInserted?: boolean }
    ) => {
      const skeletons =
        typeof structure === 'function'
          ? structure({ originX: 0, originY: 0 })
          : structure;
      return skeletons.length;
    }
  ),
  focusCanvas: vi.fn(),
  getViewportCenter: vi.fn(() => ({ originX: 0, originY: 0 })),
  exportPayload: vi.fn(async () => ({
    sceneJson: '{}',
    previewBlob: new Blob([''], { type: 'image/png' }),
    previewMimeType: 'image/png' as const,
  })),
};

vi.mock('@/features/lousas/hooks/useLousas', () => ({
  useCreateLousaMutation: () => STABLE_IDLE_MUTATION,
  useUpdateLousaMutation: () => STABLE_IDLE_MUTATION,
}));

vi.mock('@/features/lousas/api/lousasApi', () => ({
  lousasApi: {
    getLousaById: vi.fn(),
  },
}));

vi.mock('@/features/lousas/components/LousaExcalidrawCanvas', () => {
  const MockCanvas = forwardRef<
    LousaExcalidrawCanvasHandle,
    {
      onStatusChange: (status: LousaLiveStatus) => void;
    }
  >(function MockCanvas(_props, ref) {
    useImperativeHandle(ref, () => ({
      insertStructure: MOCK_CANVAS_HANDLE_SPIES.insertStructure,
      focusCanvas: MOCK_CANVAS_HANDLE_SPIES.focusCanvas,
      getViewportCenter: MOCK_CANVAS_HANDLE_SPIES.getViewportCenter,
      exportPayload: MOCK_CANVAS_HANDLE_SPIES.exportPayload,
    }));

    return <div data-testid="mock-excalidraw-canvas" />;
  });

  return {
    LousaExcalidrawCanvas: MockCanvas,
  };
});

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

let mountContainer: HTMLDivElement | null = null;
let activeRoot: ReturnType<typeof createRoot> | null = null;

beforeEach(() => {
  MOCK_CANVAS_HANDLE_SPIES.insertStructure.mockClear();
  MOCK_CANVAS_HANDLE_SPIES.focusCanvas.mockClear();
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

function findButtonByText(text: string): HTMLButtonElement {
  const buttons = Array.from(document.body.querySelectorAll('button'));
  const match = buttons.find((button) => button.textContent?.includes(text));
  if (!match) {
    throw new Error(`Botão não encontrado: "${text}"`);
  }
  return match;
}

async function setTextareaValue(
  textarea: HTMLTextAreaElement,
  value: string
): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value'
  );
  await act(async () => {
    descriptor?.set?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
  });
}

describe('LousaStructuresPopover em LousaCanvasModal', () => {
  it('abre o painel Estruturas, fecha apenas o painel com Escape e valida lista de arestas antes de inserir na lousa', async () => {
    const onOpenChangeSpy = vi.fn();

    await renderDom(
      <LousaCanvasModal
        open
        onOpenChange={onOpenChangeSpy}
        onSaved={() => undefined}
      />
    );

    // Garante que o Suspense do lazy canvas resolveu
    await act(async () => {
      await Promise.resolve();
    });

    const structuresButton = findButtonByText('Estruturas');
    await act(async () => {
      structuresButton.click();
      await Promise.resolve();
    });

    expect(
      document.body.querySelector(
        '[aria-label="Estruturas de estudo para inserir na lousa"]'
      )
    ).not.toBeNull();

    // Pressionar Escape fecha SOMENTE o popover Estruturas
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
      await Promise.resolve();
    });

    expect(
      document.body.querySelector(
        '[aria-label="Estruturas de estudo para inserir na lousa"]'
      )
    ).toBeNull();
    expect(onOpenChangeSpy).not.toHaveBeenCalled();

    // Reabre painel Estruturas e testa aba Grafo -> Lista de arestas
    await act(async () => {
      findButtonByText('Estruturas').click();
      await Promise.resolve();
    });

    const graphTab = Array.from(
      document.body.querySelectorAll('[role="tab"]')
    ).find((el) => el.textContent?.includes('Grafo')) as
      | HTMLElement
      | undefined;
    expect(graphTab).toBeDefined();

    await act(async () => {
      graphTab?.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0 })
      );
      graphTab?.click();
      await Promise.resolve();
    });

    await act(async () => {
      findButtonByText('Lista de arestas').click();
      await Promise.resolve();
    });

    const edgeTextarea = document.body.querySelector(
      '#lousa-graph-edge-list'
    ) as HTMLTextAreaElement | null;
    expect(edgeTextarea).not.toBeNull();
    if (!edgeTextarea) {
      return;
    }

    // Entrada inválida desabilita inserção e exibe alerta inline
    await setTextareaValue(edgeTextarea, '1-1');
    const panel = document.body.querySelector(
      '[aria-label="Estruturas de estudo para inserir na lousa"]'
    );
    expect(panel?.querySelector('[role="alert"]')?.textContent).toContain(
      'Autolaço'
    );
    expect(findButtonByText('Inserir na lousa').disabled).toBe(true);

    // Entrada válida atualiza contagem em tempo real e insere no canvas
    await setTextareaValue(edgeTextarea, '1-2, 2-3, 4');
    expect(panel?.textContent).toContain('4 vértice(s) • 2 aresta(s)');
    const insertButton = findButtonByText('Inserir na lousa');
    expect(insertButton.disabled).toBe(false);

    await act(async () => {
      insertButton.click();
      await Promise.resolve();
    });

    expect(MOCK_CANVAS_HANDLE_SPIES.insertStructure).toHaveBeenCalledTimes(1);
    expect(
      document.body.querySelector(
        '[aria-label="Estruturas de estudo para inserir na lousa"]'
      )
    ).toBeNull();
  });
});
