import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownMathRenderer } from '@/components/markdown/MarkdownMathRenderer';
import { prepareMarkdownMathContent } from '@/lib/markdownMath';

function renderMarkdown(content: string): string {
  return renderToStaticMarkup(
    createElement(MarkdownMathRenderer, { content })
  );
}

describe('markdownMath + MarkdownMathRenderer', () => {
  describe('prepareMarkdownMathContent', () => {
    it('normaliza delimitadores \\(...\\), \\[...\\], espaços ocasionais em $ N $ e ambientes soltos', () => {
      expect(prepareMarkdownMathContent('Valor \\( N \\) e \\( x + y \\).')).toBe(
        'Valor $N$ e $x + y$.'
      );

      expect(prepareMarkdownMathContent('Temos $ N $ vértices.')).toBe(
        'Temos $N$ vértices.'
      );

      const bracketResult = prepareMarkdownMathContent(
        'Considere \\[ x = \\frac{a}{b} \\] abaixo.'
      );
      expect(bracketResult).toBe('Considere\n$$\nx = \\frac{a}{b}\n$$\nabaixo.');

      const envResult = prepareMarkdownMathContent(
        'Definição:\n\\begin{cases}\n  x + y = 1 \\\\\n  x - y = 0\n\\end{cases}'
      );
      expect(envResult).toContain('$$\n\\begin{cases}');
      expect(envResult).toContain('\\end{cases}\n$$');
    });

    it('normaliza $$...$$ em linha única para bloco display preservando listas e blockquotes', () => {
      expect(prepareMarkdownMathContent('Temos $$x^2 + y^2 = z^2$$ logo.')).toBe(
        'Temos\n$$\nx^2 + y^2 = z^2\n$$\nlogo.'
      );

      const listInput = '- Item 1: $$a_i = b_i + 1$$';
      const listPrepared = prepareMarkdownMathContent(listInput);
      expect(listPrepared).toBe('- Item 1:\n  $$\n  a_i = b_i + 1\n  $$');

      const bqInput = '> Veja \\[ a + b = c \\]';
      const bqPrepared = prepareMarkdownMathContent(bqInput);
      expect(bqPrepared).toBe('> Veja\n> $$\n> a + b = c\n> $$');
    });

    it('preserva integralmente blocos de código cercados e inline code spans', () => {
      const input = [
        'Use `echo $HOME` ou `\\[a + b\\]` e `\\(N\\)`.',
        '',
        '```bash',
        'PRICE="R$ 100"',
        'echo $VAR',
        '\\[ \\frac{1}{2} \\]',
        '```',
        '',
        'E fora temos \\( N \\).',
      ].join('\n');

      const output = prepareMarkdownMathContent(input);
      expect(output).toContain('Use `echo $HOME` ou `\\[a + b\\]` e `\\(N\\)`.');
      expect(output).toContain('PRICE="R$ 100"\necho $VAR\n\\[ \\frac{1}{2} \\]');
      expect(output).toContain('E fora temos $N$.');
    });

    it('protege valores monetários contra falso positivo sem quebrar matemática legítima', () => {
      const money = prepareMarkdownMathContent(
        'O ingresso custa R$ 100 e R$ 200 ou US$ 50, mas entre $100 e $200 varia.'
      );
      expect(money).toContain('R\\$ 100');
      expect(money).toContain('R\\$ 200');
      expect(money).toContain('US\\$ 50');
      expect(money).toContain('\\$100 e ');

      const math = prepareMarkdownMathContent(
        'Restrição: $1 \\le N \\le 2 \\times 10^5$ e Custa $100, onde $x = 1$.'
      );
      expect(math).toContain('$1 \\le N \\le 2 \\times 10^5$');
      expect(math).toContain('\\$100, onde $x = 1$');
    });
  });

  describe('MarkdownMathRenderer (renderização KaTeX + GFM + segurança)', () => {
    it('renderiza $...$, \\(...\\), $$...$$, \\[...\\] e \\begin{cases} com KaTeX', () => {
      const inlineHtml = renderMarkdown(
        'Complexidade $O(N \\log N)$ com \\( K \\) termos e $1 \\le N \\le 2 \\times 10^5$.'
      );
      expect(inlineHtml).toContain('class="katex"');
      expect(inlineHtml).not.toContain('katex-display');
      expect(inlineHtml).toContain('O(N \\log N)');
      expect(inlineHtml).toContain('<annotation encoding="application/x-tex">K</annotation>');

      const displaySingleHtml = renderMarkdown('Fórmula $$x^2 + y^2 = z^2$$.');
      expect(displaySingleHtml).toContain('katex-display');

      const displayBracketHtml = renderMarkdown(
        '\\[\nf(n) =\n\\begin{cases}\n1, & n = 0 \\\\\nn \\cdot f(n-1), & n > 0\n\\end{cases}\n\\]'
      );
      expect(displayBracketHtml).toContain('katex-display');
      expect(displayBracketHtml).toContain('\\begin{cases}');

      const bareEnvHtml = renderMarkdown(
        '\\begin{aligned}\na &= b + c \\\\\nd &= e + f\n\\end{aligned}'
      );
      expect(bareEnvHtml).toContain('katex-display');
    });

    it('mantém listas, blockquotes e tabelas íntegros com matemática embutida', () => {
      const md = [
        '- Item 1: \\[ x^2 = 4 \\]',
        '- Item 2',
        '',
        '> Nota: $$a + b = c$$',
        '',
        '| Entrada | Saída |',
        '| --- | --- |',
        '| \\[ x_i \\] | $y_i$ |',
      ].join('\n');

      const html = renderMarkdown(md);
      expect(html).toContain('<ul');
      expect(html).toContain('<blockquote');
      expect(html).toContain('<table');
      expect(html).toContain('class="katex"');
    });

    it('não renderiza LaTeX dentro de blocos de código ou crases inline e não estiliza code de bloco como pill', () => {
      const html = renderMarkdown(
        'Inline `$HOME` e `\\(N\\)`.\n\n```cpp\nint x = 1; // $a + b$\n```'
      );
      expect(html).not.toContain('class="katex"');
      expect(html).toContain('$HOME');
      expect(html).toContain('<pre');
      // <pre> possui reset de borda/fundo para <code> filho e class="language-cpp" no <code>
      expect(html).toContain('class="font-mono text-xs text-foreground language-cpp"');
    });

    it('não transforma moeda em itálico KaTeX e preserva quebras de linha simples', () => {
      const moneyHtml = renderMarkdown(
        'Valor entre R$ 100 e R$ 200 ou US$ 50 e $100 a $200.'
      );
      expect(moneyHtml).not.toContain('class="katex"');
      expect(moneyHtml).toContain('R$ 100 e R$ 200');
      expect(moneyHtml).toContain('US$ 50');

      const breaksHtml = renderMarkdown(
        'Entrada\nA primeira linha contém $N$.'
      );
      expect(breaksHtml).toContain('<br/>');
      expect(breaksHtml).toContain('class="katex"');
    });

    it('trata LaTeX inválido sem quebrar a renderização e bloqueia links/HTML XSS', () => {
      const invalidHtml = renderMarkdown(
        'Expressão quebrada $\\frac{1}{$ e macro \\(\\naoexiste{x}\\).'
      );
      expect(invalidHtml).toContain('Expressão quebrada');
      expect(invalidHtml).toContain('katex-error');

      const xssHtml = renderMarkdown(
        '[clique aqui](javascript:alert(1)) e [seguro](https://codeforces.com) e <script>alert(1)</script>'
      );
      expect(xssHtml).not.toContain('javascript:');
      expect(xssHtml).not.toContain('<script>');
      expect(xssHtml).toContain('href="https://codeforces.com"');
      expect(xssHtml).toContain('rel="noopener noreferrer"');
    });
  });
});
