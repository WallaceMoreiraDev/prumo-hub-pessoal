// @vitest-environment happy-dom
import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { FileText, Pencil } from 'lucide-react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CollapsibleStickySection } from '@/components/layout/CollapsibleStickySection';
import {
  ListUpdatingStatus,
  ListUpdatingTopBar,
  SearchUpdatingSpinner,
  getSearchInputPaddingClass,
} from '@/components/layout/ListFilterFeedback';

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

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
});

function renderDom(element: ReactElement): HTMLDivElement {
  mountContainer = document.createElement('div');
  document.body.appendChild(mountContainer);
  activeRoot = createRoot(mountContainer);
  act(() => {
    activeRoot?.render(element);
  });
  return mountContainer;
}

describe('CollapsibleStickySection', () => {
  it('inicia aberto por padrão, aplica sticky top-14 md:top-0 z-20 e alterna Recolher/Expandir', () => {
    const container = renderDom(
      <CollapsibleStickySection
        title="Enunciado completo"
        icon={<FileText className="h-4 w-4 text-primary" strokeWidth={1.75} />}
      >
        <p data-testid="section-body">Conteúdo detalhado da questão</p>
      </CollapsibleStickySection>
    );

    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    expect(section?.className).not.toContain('overflow-hidden');

    const stickyBar = section?.firstElementChild as HTMLElement | null;
    expect(stickyBar?.className).toContain('sticky');
    expect(stickyBar?.className).toContain('top-14');
    expect(stickyBar?.className).toContain('md:top-0');
    expect(stickyBar?.className).toContain('z-20');
    expect(stickyBar?.className).toContain('bg-card/95');
    expect(stickyBar?.className).toContain('backdrop-blur-md');
    expect(stickyBar?.className).toContain('rounded-t-xl');
    expect(stickyBar?.className).toContain('border-b');

    const toggleButton = container.querySelector(
      'button[aria-expanded]'
    ) as HTMLButtonElement | null;
    expect(toggleButton).not.toBeNull();
    expect(toggleButton?.getAttribute('aria-expanded')).toBe('true');
    expect(toggleButton?.textContent).toContain('Recolher');

    const controlsId = toggleButton?.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    const panel = controlsId ? document.getElementById(controlsId) : null;
    expect(panel).not.toBeNull();
    expect(
      container.querySelector('[data-testid="section-body"]')
    ).not.toBeNull();

    // Recolhe a subseção
    act(() => {
      toggleButton?.click();
    });

    expect(toggleButton?.getAttribute('aria-expanded')).toBe('false');
    expect(toggleButton?.textContent).toContain('Expandir');
    expect(stickyBar?.className).toContain('rounded-xl');
    expect(stickyBar?.className).toContain('border-b-0');
    expect(container.querySelector('[data-testid="section-body"]')).toBeNull();

    // Expande novamente
    act(() => {
      toggleButton?.click();
    });

    expect(toggleButton?.getAttribute('aria-expanded')).toBe('true');
    expect(toggleButton?.textContent).toContain('Recolher');
    expect(
      container.querySelector('[data-testid="section-body"]')
    ).not.toBeNull();
  });

  it('renderiza variant standalone, respeita defaultOpen=false e mantém actions fora do button toggle', () => {
    const onActionSpy = vi.fn();

    const container = renderDom(
      <CollapsibleStickySection
        variant="standalone"
        defaultOpen={false}
        title="Observação pós-revisão"
        actions={
          <button type="button" onClick={onActionSpy}>
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Editar</span>
          </button>
        }
      >
        <p data-testid="standalone-body">Texto da observação</p>
      </CollapsibleStickySection>
    );

    const toggleButton = container.querySelector(
      'button[aria-expanded]'
    ) as HTMLButtonElement | null;
    expect(toggleButton?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-testid="standalone-body"]')).toBeNull();

    // Garante que não há botão aninhado dentro de outro botão
    expect(toggleButton?.querySelectorAll('button').length).toBe(0);

    const stickyBar = container.querySelector('section')?.firstElementChild;
    expect(stickyBar?.className).toContain('sticky');
    expect(stickyBar?.className).toContain('rounded-xl');
    expect(stickyBar?.className).toContain('shadow-sm');

    const actionButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Editar')
    );
    expect(actionButton).toBeDefined();

    // Clicar no botão de ação não alterna o estado recolhido
    act(() => {
      actionButton?.click();
    });
    expect(onActionSpy).toHaveBeenCalledTimes(1);
    expect(toggleButton?.getAttribute('aria-expanded')).toBe('false');

    // Agora expande clicando no toggle
    act(() => {
      toggleButton?.click();
    });
    expect(toggleButton?.getAttribute('aria-expanded')).toBe('true');
    expect(
      container.querySelector('[data-testid="standalone-body"]')
    ).not.toBeNull();
  });
});

describe('ListFilterFeedback', () => {
  it('exibe barra de progresso, status "Atualizando resultados" e posiciona spinner sem sobrepor botão limpar', () => {
    const updatingContainer = renderDom(
      <div>
        <ListUpdatingTopBar isUpdating={true} />
        <ListUpdatingStatus />
        <SearchUpdatingSpinner isUpdating={true} hasClearButton={true} />
      </div>
    );

    const progress = updatingContainer.querySelector('[role="progressbar"]');
    expect(progress).not.toBeNull();
    expect(progress?.getAttribute('aria-busy')).toBe('true');
    expect(updatingContainer.textContent).toContain('Atualizando resultados');

    const spinner = updatingContainer.querySelector(
      '[data-testid="search-updating-spinner"]'
    );
    expect(spinner?.getAttribute('class')).toContain('right-9');
    expect(spinner?.getAttribute('class')).toContain('-translate-y-1/2');

    const spinnerIcon = spinner?.querySelector('svg');
    expect(spinnerIcon).not.toBeNull();
    expect(spinnerIcon?.getAttribute('class')).toContain('animate-spin');
    expect(spinnerIcon?.getAttribute('class')).not.toContain(
      '-translate-y-1/2'
    );

    expect(getSearchInputPaddingClass(true, true)).toBe('pl-9 pr-14');
    expect(getSearchInputPaddingClass(true, false)).toBe('pl-9 pr-9');
    expect(getSearchInputPaddingClass(false, false)).toBe('pl-9 pr-3');
  });

  it('oculta barra e spinner quando isUpdating é falso', () => {
    const idleContainer = renderDom(
      <div>
        <ListUpdatingTopBar isUpdating={false} />
        <SearchUpdatingSpinner isUpdating={false} hasClearButton={true} />
      </div>
    );

    expect(idleContainer.querySelector('[role="progressbar"]')).toBeNull();
    expect(
      idleContainer.querySelector('[data-testid="search-updating-spinner"]')
    ).toBeNull();
  });
});
