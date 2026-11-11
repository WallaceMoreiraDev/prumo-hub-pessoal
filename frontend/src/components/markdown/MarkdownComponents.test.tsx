// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MarkdownEditorField } from '@/components/markdown/MarkdownEditorField';
import { SmartPasteTextarea } from '@/components/markdown/SmartPasteTextarea';

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

function renderDom(element: React.ReactElement): HTMLDivElement {
  mountContainer = document.createElement('div');
  document.body.appendChild(mountContainer);
  activeRoot = createRoot(mountContainer);
  act(() => {
    activeRoot?.render(element);
  });
  return mountContainer;
}

describe('SmartPasteTextarea & MarkdownEditorField', () => {
  it('intercepta colagem KaTeX no SmartPasteTextarea, respeita maxLength e dispara onChange controlado', () => {
    const onChangeSpy = vi.fn();

    function ControlledHarness() {
      const [val, setVal] = useState('Início:  fim');
      return (
        <SmartPasteTextarea
          id="smart-paste-test"
          maxLength={60}
          value={val}
          onChange={(event) => {
            onChangeSpy(event.target.value);
            setVal(event.target.value);
          }}
        />
      );
    }

    const container = renderDom(<ControlledHarness />);
    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    if (!textarea) {
      return;
    }

    // Posiciona o cursor entre "Início: " e " fim"
    textarea.setSelectionRange(8, 8);

    const katexHtml =
      '<span class="katex"><span class="katex-mathml"><math><semantics><mrow><mi>N</mi></mrow><annotation encoding="application/x-tex">N \\le 10^5</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">NN</span></span>';

    const pasteEvent = new Event('paste', {
      bubbles: true,
      cancelable: true,
    }) as unknown as ClipboardEvent;

    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: (type: string) => {
          if (type === 'text/html') {
            return katexHtml;
          }
          if (type === 'text/plain') {
            return '𝑁\nN';
          }
          return '';
        },
      },
    });

    act(() => {
      textarea.dispatchEvent(pasteEvent);
    });

    expect(pasteEvent.defaultPrevented).toBe(true);
    expect(textarea.value).toBe('Início: $N \\le 10^5$ fim');
    expect(onChangeSpy).toHaveBeenCalledWith('Início: $N \\le 10^5$ fim');
  });

  it('mantém textarea montado no DOM ao alternar MarkdownEditorField entre Escrever e Visualizar', () => {
    function EditorHarness() {
      const [content, setContent] = useState('Considere \\( N \\) vértices.');
      return (
        <MarkdownEditorField
          id="editor-tabs-test"
          value={content}
          previewContent={content}
          onChange={(event) => setContent(event.target.value)}
        />
      );
    }

    const container = renderDom(<EditorHarness />);
    const initialTextarea = container.querySelector('textarea');
    expect(initialTextarea).not.toBeNull();

    const previewTab = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Visualizar')
    );
    expect(previewTab).toBeDefined();

    act(() => {
      previewTab?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      previewTab?.click();
    });

    // O preview renderiza KaTeX
    expect(container.innerHTML).toContain('class="katex"');

    // CRÍTICO para React Hook Form register(): mesmo textarea segue montado no DOM
    const sameTextarea = container.querySelector('textarea');
    expect(sameTextarea).toBe(initialTextarea);
    expect(sameTextarea?.value).toBe('Considere \\( N \\) vértices.');
  });
});
