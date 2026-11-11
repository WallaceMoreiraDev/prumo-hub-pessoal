// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  extractCleanPasteText,
  normalizeMathUnicodeToAscii,
} from '@/lib/clipboardToMarkdownLatex';

describe('clipboardToMarkdownLatex', () => {
  describe('normalizeMathUnicodeToAscii', () => {
    it('normaliza símbolos Mathematical Alphanumeric Symbols e remove operadores invisíveis MathML', () => {
      expect(normalizeMathUnicodeToAscii('𝑁, 𝑃, 𝑖, 𝑓, ℎ')).toBe(
        'N, P, i, f, h'
      );
      expect(normalizeMathUnicodeToAscii('𝐚\u2062𝐱 + 𝟏\u2061(𝑦)')).toBe(
        'ax + 1(y)'
      );
      // Preserva acentuação portuguesa intacta (sem decomposição NFKD)
      expect(normalizeMathUnicodeToAscii('ação, número, padrão')).toBe(
        'ação, número, padrão'
      );
    });
  });

  describe('Priority 1 — HTML rico (KaTeX, MathJax, MathML, Semântico e IDE)', () => {
    it('extrai LaTeX de spans KaTeX inline e display ignorando .katex-html visual duplicado', () => {
      const katexHtml = `
        <p>
          Dado um inteiro
          <span class="katex">
            <span class="katex-mathml">
              <math><semantics><mrow><mi>N</mi></mrow><annotation encoding="application/x-tex">N</annotation></semantics></math>
            </span>
            <span class="katex-html" aria-hidden="true"><span>N</span><span>N</span></span>
          </span>
          temos:
        </p>
        <div class="katex-display">
          <span class="katex">
            <span class="katex-mathml">
              <math display="block"><semantics><mrow><mi>a</mi></mrow><annotation encoding="application/x-tex">\\sum_{i=1}^{N} P_i</annotation></semantics></math>
            </span>
            <span class="katex-html" aria-hidden="true"><span>∑ P i</span></span>
          </span>
        </div>
      `;

      const result = extractCleanPasteText({
        html: katexHtml,
        plainText: 'Dado um inteiro 𝑁\nN\n temos:',
      });

      expect(result.transformed).toBe(true);
      expect(result.text).toContain('Dado um inteiro $N$');
      expect(result.text).toContain('$$\n\\sum_{i=1}^{N} P_i\n$$');
      expect(result.text).not.toContain('NN');
      expect(result.text).not.toContain('∑ P i');
    });

    it('extrai LaTeX de MathJax v3 (mjx-container) e MathJax v2 (MathJax + script type="math/tex") sem duplicar', () => {
      const mjxHtml = `
        <p>
          Para todo
          <mjx-container class="MathJax" jax="CHTML">
            <mjx-math aria-hidden="true">k</mjx-math>
            <mjx-assistive-mml>
              <math><semantics><mrow><mi>k</mi></mrow><annotation encoding="application/x-tex">k \\le N</annotation></semantics></math>
            </mjx-assistive-mml>
          </mjx-container>
          e bloco:
          <mjx-container display="true" jax="CHTML">
            <mjx-assistive-mml>
              <math display="block" alttext="dp[i] = min(dp[i-1], a_i)"></math>
            </mjx-assistive-mml>
          </mjx-container>
        </p>
      `;

      const mjxResult = extractCleanPasteText({ html: mjxHtml, plainText: '' });
      expect(mjxResult.transformed).toBe(true);
      expect(mjxResult.text).toContain('Para todo $k \\le N$');
      expect(mjxResult.text).toContain('$$\ndp[i] = min(dp[i-1], a_i)\n$$');

      const mjxV2Html = `
        <div>
          <span class="MathJax_Preview">[math]</span>
          <span class="MathJax" id="MathJax-Element-1-Frame">visual_lixo</span>
          <script type="math/tex" id="MathJax-Element-1">x^2 + y^2</script>
          e display:
          <div class="MathJax_Display">
            <span class="MathJax">visual_display</span>
          </div>
          <script type="math/tex; mode=display">E = mc^2</script>
        </div>
      `;

      const v2Result = extractCleanPasteText({
        html: mjxV2Html,
        plainText: 'visual_lixo',
      });
      expect(v2Result.transformed).toBe(true);
      expect(v2Result.text).toContain('$x^2 + y^2$');
      expect(v2Result.text).toContain('$$\nE = mc^2\n$$');
      expect(v2Result.text).not.toContain('visual_lixo');
      expect(v2Result.text).not.toContain('[math]');
      // Garante que o <script> consumido não duplica a fórmula
      expect(v2Result.text.match(/E = mc\^2/g)?.length).toBe(1);
    });

    it('converte MathML puro (<msub>, <mfrac>, Unicode Math) e wrappers [data-math]', () => {
      const pureMathMlHtml = `
        <p>
          Sequência
          <math>
            <msub><mi>𝑃</mi><mn>1</mn></msub>
            <mo>+</mo>
            <mfrac><mi>𝑎</mi><mi>𝑏</mi></mfrac>
            <mo>≤</mo>
            <msqrt><mi>𝑁</mi></msqrt>
          </math>
          com Gemini
          <span class="math-inline" data-math="O(N \\log N)">O(N log N)</span>.
        </p>
      `;

      const result = extractCleanPasteText({
        html: pureMathMlHtml,
        plainText: '',
      });
      expect(result.transformed).toBe(true);
      expect(result.text).toContain('$P_1+\\frac{a}{b}\\le \\sqrt{N}$');
      expect(result.text).toContain('$O(N \\log N)$');
    });

    it('NÃO transforma código colorido de IDE sem matemática nem HTML semântico', () => {
      const idePlain = 'int main() {\n  return 0;\n}';
      const vsCodeHtml = `
        <div style="color: #d4d4d4; background-color: #1e1e1e; font-family: Consolas;">
          <div><span style="color: #569cd6;">int</span> <span style="color: #dcdcaa;">main</span>() {</div>
          <div>  <span style="color: #c586c0;">return</span> <span style="color: #b5cea8;">0</span>;</div>
          <div>}</div>
        </div>
      `;

      const res1 = extractCleanPasteText({
        html: vsCodeHtml,
        plainText: idePlain,
      });
      expect(res1).toEqual({ text: idePlain, transformed: false });

      const preStyleIdeHtml = `
        <pre style="color: #d4d4d4; font-family: monospace;"><span style="color: #569cd6;">int</span> main() {}</pre>
      `;
      const res2 = extractCleanPasteText({
        html: preStyleIdeHtml,
        plainText: 'int main() {}',
      });
      expect(res2).toEqual({ text: 'int main() {}', transformed: false });
    });

    it('converte HTML semântico (headings, listas, código, tabelas, links seguros e blockquotes) para Markdown limpo', () => {
      const richHtml = `
        <h2>Solução Dinâmica</h2>
        <p>Use <strong>programação dinâmica</strong> em <code>dp[i]</code> e leia <a href="https://cp-algorithms.com">CP-Algorithms</a> e <a href="javascript:alert(1)">link malicioso</a>.</p>
        <ul>
          <li>Caso base: <em>zero</em></li>
          <li>Transição direta</li>
        </ul>
        <blockquote>Atenção aos limites!</blockquote>
        <pre><code class="language-cpp">for (int i = 0; i &lt; n; ++i) {}</code></pre>
        <table>
          <thead><tr><th>Entrada</th><th>Saída</th></tr></thead>
          <tbody><tr><td>3</td><td>6</td></tr></tbody>
        </table>
      `;

      const result = extractCleanPasteText({
        html: richHtml,
        plainText: 'Solução Dinâmica',
      });

      expect(result.transformed).toBe(true);
      expect(result.text).toContain('## Solução Dinâmica');
      expect(result.text).toContain('**programação dinâmica**');
      expect(result.text).toContain('`dp[i]`');
      expect(result.text).toContain('[CP-Algorithms](https://cp-algorithms.com)');
      expect(result.text).toContain('link malicioso');
      expect(result.text).not.toContain('javascript:');
      expect(result.text).toContain('- Caso base: *zero*\n- Transição direta');
      expect(result.text).toContain('> Atenção aos limites!');
      expect(result.text).toContain('```cpp\nfor (int i = 0; i < n; ++i) {}\n```');
      expect(result.text).toContain('| Entrada | Saída |\n| --- | --- |\n| 3 | 6 |');
    });

    it('preserva quebras de linha em entradas <pre> multi-linha estilo Codeforces', () => {
      const cfHtml = `
        <pre><div class="test-example-line">3</div><div class="test-example-line">10 20 30</div></pre>
      `;
      const result = extractCleanPasteText({ html: cfHtml, plainText: '310 20 30' });
      expect(result.transformed).toBe(true);
      expect(result.text).toBe('```\n3\n10 20 30\n```');
    });
  });

  describe('Priority 2 — Fallback de text/plain com MathML Unicode vs texto comum', () => {
    it('normaliza símbolos matemáticos Unicode e colapsa linhas duplicadas quando detectado padrão MathML', () => {
      const dirtyPlain = 'Dado um inteiro\n𝑁\nN\ne um vetor\n𝑃\nP\nde tamanho\n𝑖\ni\n.';
      const result = extractCleanPasteText({
        html: '',
        plainText: dirtyPlain,
      });

      expect(result.transformed).toBe(true);
      expect(result.text).toBe('Dado um inteiro\nN\ne um vetor\nP\nde tamanho\ni\n.');
    });

    it('mantém texto comum sem símbolos MathML exatamente intocado (transformed: false)', () => {
      const normalText = 'Linha 1\nN\nN\nTexto normal com R$ 100 e acentuação: é, ã, ç.';
      const result = extractCleanPasteText({
        html: '',
        plainText: normalText,
      });

      expect(result).toEqual({ text: normalText, transformed: false });
    });
  });
});
