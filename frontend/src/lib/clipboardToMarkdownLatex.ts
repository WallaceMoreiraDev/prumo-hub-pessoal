import { isSafeHttpUrl } from '@/lib/url';

export interface ExtractCleanPasteInput {
  html: string;
  plainText: string;
}

export interface ExtractCleanPasteResult {
  text: string;
  transformed: boolean;
}

const MATH_ALPHANUMERIC_REGEX = /[\u{1D400}-\u{1D7FF}\u210E]/u;

const LETTERLIKE_TO_ASCII: Record<number, string> = {
  0x2102: 'C',
  0x2107: 'E',
  0x210a: 'g',
  0x210b: 'H',
  0x210c: 'H',
  0x210d: 'H',
  0x210e: 'h',
  0x210f: 'h',
  0x2110: 'I',
  0x2111: 'I',
  0x2112: 'L',
  0x2113: 'l',
  0x2115: 'N',
  0x2119: 'P',
  0x211a: 'Q',
  0x211b: 'R',
  0x211c: 'R',
  0x211d: 'R',
  0x2124: 'Z',
  0x2128: 'Z',
  0x212c: 'B',
  0x212d: 'C',
  0x212f: 'e',
  0x2130: 'E',
  0x2131: 'F',
  0x2133: 'M',
  0x2134: 'o',
};

/**
 * Converte Mathematical Alphanumeric Symbols (U+1D400..U+1D7FF) e símbolos
 * matemáticos equivalentes (como U+210E `ℎ`) para ASCII ou letra base legível,
 * removendo operadores invisíveis de MathML (U+2061..U+2064).
 */
export function normalizeMathUnicodeToAscii(value: string): string {
  if (!value) {
    return '';
  }

  let result = '';
  for (const ch of value) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) {
      continue;
    }

    // Operadores invisíveis inseridos por MathML (function application, invisible times, etc.)
    if (
      cp === 0x200b ||
      cp === 0xfeff ||
      (cp >= 0x2061 && cp <= 0x2064)
    ) {
      continue;
    }

    const mappedLetterlike = LETTERLIKE_TO_ASCII[cp];
    if (mappedLetterlike) {
      result += mappedLetterlike;
      continue;
    }

    // 13 blocos consecutivos de letras Latinas A-Z / a-z (U+1D400 .. U+1D6A3)
    if (cp >= 0x1d400 && cp <= 0x1d6a3) {
      const offset = (cp - 0x1d400) % 52;
      if (offset < 26) {
        result += String.fromCharCode(65 + offset);
      } else {
        result += String.fromCharCode(97 + (offset - 26));
      }
      continue;
    }

    // 5 blocos consecutivos de dígitos 0-9 (U+1D7CE .. U+1D7FF)
    if (cp >= 0x1d7ce && cp <= 0x1d7ff) {
      const offset = (cp - 0x1d7ce) % 10;
      result += String.fromCharCode(48 + offset);
      continue;
    }

    // Variantes gregas e outros símbolos dentro de U+1D400..U+1D7FF
    if (cp >= 0x1d400 && cp <= 0x1d7ff) {
      result += ch.normalize('NFKD');
      continue;
    }

    result += ch;
  }

  return result;
}

function getElementTagLower(el: Element): string {
  return el.tagName.toLowerCase();
}

function extractTexAnnotation(root: Element): string | null {
  const annotation =
    root.querySelector('annotation[encoding="application/x-tex"]') ??
    root.querySelector('annotation[encoding="TeX"]') ??
    root.querySelector('annotation[encoding="LaTeX"]');
  const text = annotation?.textContent?.trim();
  return text && text.length > 0 ? text : null;
}

function wrapMath(tex: string, display: boolean): string {
  const cleaned = tex.trim();
  if (!cleaned) {
    return '';
  }
  if (display) {
    return `\n\n$$\n${cleaned}\n$$\n\n`;
  }
  return `$${cleaned.replace(/\s*\n\s*/g, ' ')}$`;
}

function needsBracesForScript(latex: string): boolean {
  const trimmed = latex.trim();
  return trimmed.length > 1 || !/^[a-zA-Z0-9]$/.test(trimmed);
}

function mapMathOperator(raw: string): string {
  const trimmed = normalizeMathUnicodeToAscii(raw).trim();
  switch (trimmed) {
    case '≤':
      return '\\le ';
    case '≥':
      return '\\ge ';
    case '≠':
      return '\\neq ';
    case '×':
      return '\\times ';
    case '÷':
      return '\\div ';
    case '·':
      return '\\cdot ';
    case '±':
      return '\\pm ';
    case '∞':
      return '\\infty ';
    case '→':
    case '⟶':
      return '\\to ';
    case '←':
      return '\\leftarrow ';
    case '↔':
      return '\\leftrightarrow ';
    case '⇒':
      return '\\Rightarrow ';
    case '⇔':
      return '\\Leftrightarrow ';
    case '∈':
      return '\\in ';
    case '∉':
      return '\\notin ';
    case '⊂':
      return '\\subset ';
    case '⊆':
      return '\\subseteq ';
    case '∪':
      return '\\cup ';
    case '∩':
      return '\\cap ';
    case '∑':
      return '\\sum ';
    case '∏':
      return '\\prod ';
    case '∫':
      return '\\int ';
    case '∀':
      return '\\forall ';
    case '∃':
      return '\\exists ';
    case '…':
    case '⋯':
      return '\\dots ';
    default:
      return trimmed;
  }
}

function mathMlElementToLatex(el: Element): string {
  const tag = getElementTagLower(el);

  if (tag === 'annotation' || tag === 'annotation-xml') {
    return '';
  }

  if (tag === 'semantics') {
    const tex = extractTexAnnotation(el);
    if (tex) {
      return tex;
    }
    const firstChild = el.firstElementChild;
    return firstChild ? mathMlElementToLatex(firstChild) : '';
  }

  if (tag === 'mo') {
    return mapMathOperator(el.textContent ?? '');
  }

  if (tag === 'mi' || tag === 'mn' || tag === 'mtext' || tag === 'ms') {
    const normalized = normalizeMathUnicodeToAscii(el.textContent ?? '').trim();
    if (tag === 'mtext' && normalized.length > 1 && /\s/.test(normalized)) {
      return `\\text{${normalized}}`;
    }
    return normalized;
  }

  if (tag === 'mspace') {
    return ' ';
  }

  const elementChildren = Array.from(el.children);

  if (tag === 'msub' && elementChildren.length >= 2) {
    const base = mathMlElementToLatex(elementChildren[0]!);
    const sub = mathMlElementToLatex(elementChildren[1]!).trim();
    return needsBracesForScript(sub) ? `${base}_{${sub}}` : `${base}_${sub}`;
  }

  if (tag === 'msup' && elementChildren.length >= 2) {
    const base = mathMlElementToLatex(elementChildren[0]!);
    const sup = mathMlElementToLatex(elementChildren[1]!).trim();
    return needsBracesForScript(sup) ? `${base}^{${sup}}` : `${base}^${sup}`;
  }

  if (tag === 'msubsup' && elementChildren.length >= 3) {
    const base = mathMlElementToLatex(elementChildren[0]!);
    const sub = mathMlElementToLatex(elementChildren[1]!).trim();
    const sup = mathMlElementToLatex(elementChildren[2]!).trim();
    const subPart = needsBracesForScript(sub) ? `_{${sub}}` : `_${sub}`;
    const supPart = needsBracesForScript(sup) ? `^{${sup}}` : `^${sup}`;
    return `${base}${subPart}${supPart}`;
  }

  if (tag === 'mfrac' && elementChildren.length >= 2) {
    const num = mathMlElementToLatex(elementChildren[0]!).trim();
    const den = mathMlElementToLatex(elementChildren[1]!).trim();
    return `\\frac{${num}}{${den}}`;
  }

  if (tag === 'msqrt') {
    const inner = elementChildren.map(mathMlElementToLatex).join('').trim();
    return `\\sqrt{${inner}}`;
  }

  if (tag === 'mroot' && elementChildren.length >= 2) {
    const base = mathMlElementToLatex(elementChildren[0]!).trim();
    const index = mathMlElementToLatex(elementChildren[1]!).trim();
    return `\\sqrt[${index}]{${base}}`;
  }

  if (tag === 'munder' && elementChildren.length >= 2) {
    const base = mathMlElementToLatex(elementChildren[0]!).trim();
    const under = mathMlElementToLatex(elementChildren[1]!).trim();
    return `${base}_{${under}}`;
  }

  if (tag === 'mover' && elementChildren.length >= 2) {
    const base = mathMlElementToLatex(elementChildren[0]!).trim();
    const over = mathMlElementToLatex(elementChildren[1]!).trim();
    if (over === '¯' || over === '-' || over === '‾') {
      return `\\overline{${base}}`;
    }
    if (over === '^' || over === 'ˆ') {
      return `\\hat{${base}}`;
    }
    return `${base}^{${over}}`;
  }

  if (tag === 'munderover' && elementChildren.length >= 3) {
    const base = mathMlElementToLatex(elementChildren[0]!).trim();
    const under = mathMlElementToLatex(elementChildren[1]!).trim();
    const over = mathMlElementToLatex(elementChildren[2]!).trim();
    return `${base}_{${under}}^{${over}}`;
  }

  if (tag === 'mfenced') {
    const open = el.getAttribute('open') ?? '(';
    const close = el.getAttribute('close') ?? ')';
    const sep = el.getAttribute('separators') ?? ',';
    const parts = elementChildren.map((child) =>
      mathMlElementToLatex(child).trim()
    );
    return `${open}${parts.join(`${sep[0] ?? ','} `)}${close}`;
  }

  if (tag === 'mtable') {
    const rows = elementChildren
      .map((row) => {
        if (getElementTagLower(row) !== 'mtr') {
          return mathMlElementToLatex(row);
        }
        return Array.from(row.children)
          .map((cell) => mathMlElementToLatex(cell).trim())
          .join(' & ');
      })
      .join(' \\\\ ');
    return `\\begin{matrix} ${rows} \\end{matrix}`;
  }

  if (elementChildren.length > 0) {
    return elementChildren.map(mathMlElementToLatex).join('');
  }

  return normalizeMathUnicodeToAscii(el.textContent ?? '');
}

function extractMathFromMathMl(mathEl: Element): string | null {
  const fromAnnotation = extractTexAnnotation(mathEl);
  if (fromAnnotation) {
    return fromAnnotation;
  }

  const alttext = mathEl.getAttribute('alttext')?.trim();
  if (alttext) {
    return alttext;
  }

  const converted = mathMlElementToLatex(mathEl).trim();
  return converted.length > 0 ? converted : null;
}

function hasMathOrSemanticHtml(body: HTMLElement): {
  hasMath: boolean;
  hasSemanticMarkdown: boolean;
} {
  const hasMath = Boolean(
    body.querySelector(
      [
        '.katex',
        '.katex-display',
        'mjx-container',
        '.MathJax',
        '.MathJax_Display',
        '.MathJax_CHTML',
        '.MathJax_SVG',
        'math',
        'script[type^="math/tex"]',
        '[data-latex]',
        '[data-tex]',
        '[data-math]',
        '.tex-span',
      ].join(',')
    )
  );

  const semanticNodes = body.querySelectorAll(
    'h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote, strong, b, em, i, code, pre, a[href]'
  );

  if (semanticNodes.length === 0) {
    return { hasMath, hasSemanticMarkdown: false };
  }

  // Detecta snippet copiado de IDE (ex.: VS Code coloca <pre> sem language-* apenas com spans coloridos,
  // ou <b>/<i> sintéticos sem semântica real; se for só <pre> com style e sem language-*, preserva text/plain).
  let meaningfulCount = 0;
  for (const node of Array.from(semanticNodes)) {
    const tag = getElementTagLower(node);
    if (tag === 'pre') {
      const codeChild = node.querySelector('code');
      const hasLangClass = Boolean(
        codeChild?.className.match(/(?:language-|lang-)[a-zA-Z0-9_+#.-]+/) ||
          node.className.match(/(?:language-|lang-)[a-zA-Z0-9_+#.-]+/) ||
          node.getAttribute('data-language')
      );
      const hasStyleAttr = node.hasAttribute('style');
      if (!hasLangClass && hasStyleAttr) {
        continue;
      }
    }
    meaningfulCount++;
  }

  return { hasMath, hasSemanticMarkdown: meaningfulCount > 0 };
}

function detectCodeLanguage(preEl: Element): string {
  const codeEl = preEl.querySelector('code');
  const candidates = [
    codeEl?.getAttribute('data-language'),
    preEl.getAttribute('data-language'),
    codeEl?.className,
    preEl.className,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const classMatch = candidate.match(
      /(?:^|\s)(?:language-|lang-)([a-zA-Z0-9_+#.-]+)/
    );
    if (classMatch?.[1]) {
      return classMatch[1];
    }
    if (!candidate.includes(' ') && /^[a-zA-Z0-9_+#.-]+$/.test(candidate)) {
      return candidate;
    }
  }

  return '';
}

function wrapInlineCode(raw: string): string {
  const normalized = raw.replace(/\r\n?/g, '\n');
  let maxRun = 0;
  const matches = normalized.matchAll(/`+/g);
  for (const match of matches) {
    maxRun = Math.max(maxRun, match[0].length);
  }
  const fence = '`'.repeat(maxRun + 1);
  const needsPadding =
    normalized.startsWith('`') || normalized.endsWith('`');
  return needsPadding
    ? `${fence} ${normalized} ${fence}`
    : `${fence}${normalized}${fence}`;
}

function wrapFencedCode(raw: string, language: string): string {
  const cleaned = raw.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  let maxRun = 2;
  const matches = cleaned.matchAll(/`+/g);
  for (const match of matches) {
    maxRun = Math.max(maxRun, match[0].length);
  }
  const fence = '`'.repeat(maxRun + 1);
  return `\n\n${fence}${language}\n${cleaned}\n${fence}\n\n`;
}

function wrapWithPreservedOuterSpaces(
  content: string,
  marker: string
): string {
  if (!content || content.trim().length === 0) {
    return content;
  }
  const leading = content.match(/^\s*/)?.[0] ?? '';
  const trailing = content.match(/\s*$/)?.[0] ?? '';
  const core = content.slice(leading.length, content.length - trailing.length);
  if (!core) {
    return content;
  }
  return `${leading}${marker}${core}${marker}${trailing}`;
}

function convertTexSpanToInlineMath(el: Element): string {
  const serializeChild = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return normalizeMathUnicodeToAscii(node.textContent ?? '');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    const childEl = node as Element;
    const tag = getElementTagLower(childEl);
    const inner = Array.from(childEl.childNodes).map(serializeChild).join('');
    if (tag === 'sup') {
      const trimmed = inner.trim();
      return needsBracesForScript(trimmed) ? `^{${trimmed}}` : `^${trimmed}`;
    }
    if (tag === 'sub') {
      const trimmed = inner.trim();
      return needsBracesForScript(trimmed) ? `_{${trimmed}}` : `_${trimmed}`;
    }
    return inner;
  };

  const tex = Array.from(el.childNodes).map(serializeChild).join('').trim();
  return tex ? `$${tex}$` : '';
}

interface WalkContext {
  listDepth: number;
  consumedNodes: WeakSet<Node>;
  inCodeOrPre: boolean;
}

function serializeNodes(nodes: NodeListOf<ChildNode> | ChildNode[], ctx: WalkContext): string {
  let out = '';
  for (const node of Array.from(nodes)) {
    out += serializeNode(node, ctx);
  }
  return out;
}

function extractMathFromWrapper(el: Element, ctx: WalkContext): {
  tex: string | null;
  display: boolean;
} {
  const isDisplayClass =
    el.classList.contains('katex-display') ||
    el.classList.contains('MathJax_Display') ||
    el.classList.contains('math-block') ||
    el.getAttribute('display') === 'true' ||
    el.getAttribute('display') === 'block';

  const explicitLatexAttr =
    el.getAttribute('data-latex')?.trim() ||
    el.getAttribute('data-tex')?.trim() ||
    el.getAttribute('data-math')?.trim();

  if (explicitLatexAttr) {
    return { tex: explicitLatexAttr, display: isDisplayClass || el.tagName.toLowerCase() === 'div' };
  }

  const innerScript = el.querySelector('script[type^="math/tex"]');
  if (innerScript) {
    ctx.consumedNodes.add(innerScript);
    const scriptTex = innerScript.textContent?.trim() ?? '';
    const scriptDisplay =
      isDisplayClass ||
      (innerScript.getAttribute('type') ?? '').includes('mode=display');
    if (scriptTex) {
      return { tex: scriptTex, display: scriptDisplay };
    }
  }

  // MathJax v2 frequentemente coloca <script type="math/tex"> como próximo elemento irmão
  const nextSibling = el.nextElementSibling;
  if (
    nextSibling &&
    getElementTagLower(nextSibling) === 'script' &&
    (nextSibling.getAttribute('type') ?? '').startsWith('math/tex')
  ) {
    ctx.consumedNodes.add(nextSibling);
    const siblingTex = nextSibling.textContent?.trim() ?? '';
    const siblingDisplay =
      isDisplayClass ||
      (nextSibling.getAttribute('type') ?? '').includes('mode=display');
    if (siblingTex) {
      return { tex: siblingTex, display: siblingDisplay };
    }
  }

  const annotationTex = extractTexAnnotation(el);
  if (annotationTex) {
    const mathEl = el.querySelector('math');
    const mathDisplay =
      isDisplayClass || mathEl?.getAttribute('display') === 'block';
    return { tex: annotationTex, display: mathDisplay };
  }

  const mathEl = el.querySelector('math');
  if (mathEl) {
    const mmlTex = extractMathFromMathMl(mathEl);
    const mathDisplay =
      isDisplayClass || mathEl.getAttribute('display') === 'block';
    return { tex: mmlTex, display: mathDisplay };
  }

  return { tex: null, display: isDisplayClass };
}

function serializeTable(tableEl: Element, ctx: WalkContext): string {
  const rowElements = Array.from(tableEl.querySelectorAll('tr'));
  if (rowElements.length === 0) {
    return '';
  }

  const matrix: string[][] = [];
  let maxCols = 0;

  for (const tr of rowElements) {
    const cells = Array.from(tr.children).filter((child) => {
      const tag = getElementTagLower(child);
      return tag === 'th' || tag === 'td';
    });
    if (cells.length === 0) {
      continue;
    }
    const renderedCells = cells.map((cell) => {
      const inner = serializeNodes(cell.childNodes, ctx)
        .replace(/\n+/g, ' ')
        .trim();
      return inner;
    });
    maxCols = Math.max(maxCols, renderedCells.length);
    matrix.push(renderedCells);
  }

  if (matrix.length === 0 || maxCols === 0) {
    return '';
  }

  const padRow = (row: string[]): string[] => {
    const next = [...row];
    while (next.length < maxCols) {
      next.push('');
    }
    return next;
  };

  const headerRow = padRow(matrix[0]!);
  const separatorRow = Array.from({ length: maxCols }, () => '---');
  const bodyRows = matrix.slice(1).map(padRow);

  const formatRow = (row: string[]): string => `| ${row.join(' | ')} |`;

  const lines = [
    formatRow(headerRow),
    formatRow(separatorRow),
    ...bodyRows.map(formatRow),
  ];

  return `\n\n${lines.join('\n')}\n\n`;
}

function serializeList(
  listEl: Element,
  ordered: boolean,
  ctx: WalkContext
): string {
  const items = Array.from(listEl.children).filter(
    (child) => getElementTagLower(child) === 'li'
  );
  if (items.length === 0) {
    return '';
  }

  const indent = '  '.repeat(ctx.listDepth);
  const startAttr = Number(listEl.getAttribute('start') ?? '1');
  let counter = Number.isFinite(startAttr) && startAttr > 0 ? startAttr : 1;

  const lines: string[] = [];
  for (const li of items) {
    const prefix = ordered ? `${counter}. ` : '- ';
    counter += 1;

    const childCtx: WalkContext = {
      ...ctx,
      listDepth: ctx.listDepth + 1,
    };

    const rawItem = serializeNodes(li.childNodes, childCtx).trim();
    if (!rawItem) {
      lines.push(`${indent}${prefix.trimEnd()}`);
      continue;
    }

    const continuationIndent = indent + ' '.repeat(prefix.length);
    const itemLines = rawItem.replace(/\n{3,}/g, '\n\n').split('\n');
    const formattedItemLines = itemLines.map((line, index) => {
      if (index === 0) {
        return `${indent}${prefix}${line}`;
      }
      if (line.trim() === '') {
        return '';
      }
      // Linhas de sub-listas já recebem indentação própria via listDepth + 1
      if (line.startsWith(continuationIndent)) {
        return line;
      }
      return `${continuationIndent}${line}`;
    });

    lines.push(formattedItemLines.join('\n'));
  }

  if (ctx.listDepth === 0) {
    return `\n\n${lines.join('\n')}\n\n`;
  }
  return `\n${lines.join('\n')}`;
}

function extractPreText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }
  const el = node as Element;
  const tag = getElementTagLower(el);
  if (tag === 'br') {
    return '\n';
  }
  const inner = Array.from(el.childNodes).map(extractPreText).join('');
  if ((tag === 'div' || tag === 'p' || tag === 'li') && !inner.endsWith('\n')) {
    return `${inner}\n`;
  }
  return inner;
}

function serializeNode(node: Node, ctx: WalkContext): string {
  if (ctx.consumedNodes.has(node)) {
    return '';
  }

  if (node.nodeType === Node.TEXT_NODE) {
    const rawText = node.textContent ?? '';
    if (ctx.inCodeOrPre) {
      return rawText;
    }
    const withoutZeroWidth = normalizeMathUnicodeToAscii(rawText);
    // Colapsa quebras de formatação HTML que não são conteúdo significativo
    return withoutZeroWidth.replace(/[ \t\r\n]+/g, (match) =>
      match.includes('\n') ? ' ' : match
    );
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as Element;
  const tag = getElementTagLower(el);

  if (tag === 'style' || tag === 'noscript' || tag === 'template') {
    return '';
  }

  if (tag === 'script') {
    const type = el.getAttribute('type') ?? '';
    if (type.startsWith('math/tex')) {
      const tex = el.textContent?.trim() ?? '';
      return wrapMath(tex, type.includes('mode=display'));
    }
    return '';
  }

  // Ignora camada visual oculta do KaTeX/MathJax
  if (
    el.classList.contains('katex-html') ||
    el.classList.contains('MJX_Assistive_MathML')
  ) {
    if (el.classList.contains('MJX_Assistive_MathML')) {
      const mathEl = el.querySelector('math');
      if (mathEl) {
        const tex = extractMathFromMathMl(mathEl);
        if (tex) {
          return wrapMath(tex, mathEl.getAttribute('display') === 'block');
        }
      }
    }
    return '';
  }

  if (el.classList.contains('MathJax_Preview')) {
    const nextEl = el.nextElementSibling;
    if (
      nextEl &&
      (nextEl.classList.contains('MathJax') ||
        nextEl.classList.contains('MathJax_Display') ||
        getElementTagLower(nextEl) === 'script')
    ) {
      return '';
    }
  }

  // Wrappers de fórmula KaTeX / MathJax / atributos data-latex / data-math
  if (
    el.classList.contains('katex-display') ||
    el.classList.contains('katex') ||
    tag === 'mjx-container' ||
    el.classList.contains('MathJax_Display') ||
    el.classList.contains('MathJax') ||
    el.classList.contains('MathJax_CHTML') ||
    el.classList.contains('MathJax_SVG') ||
    el.hasAttribute('data-latex') ||
    el.hasAttribute('data-tex') ||
    el.hasAttribute('data-math')
  ) {
    const extracted = extractMathFromWrapper(el, ctx);
    if (extracted.tex) {
      return wrapMath(extracted.tex, extracted.display);
    }
  }

  if (tag === 'math') {
    const tex = extractMathFromMathMl(el);
    if (tex) {
      return wrapMath(tex, el.getAttribute('display') === 'block');
    }
    return '';
  }

  if (el.classList.contains('tex-span')) {
    return convertTexSpanToInlineMath(el);
  }

  if (tag === 'br') {
    return '\n';
  }

  if (tag === 'hr') {
    return '\n\n---\n\n';
  }

  if (tag === 'pre') {
    const lang = detectCodeLanguage(el);
    const codeText = extractPreText(el);
    return wrapFencedCode(codeText, lang);
  }

  if (tag === 'code') {
    if (ctx.inCodeOrPre) {
      return el.textContent ?? '';
    }
    const rawCode = normalizeMathUnicodeToAscii(el.textContent ?? '').trim();
    return rawCode ? wrapInlineCode(rawCode) : '';
  }

  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
    const level = Number(tag[1]);
    const inner = serializeNodes(el.childNodes, ctx).trim();
    return inner ? `\n\n${'#'.repeat(level)} ${inner}\n\n` : '';
  }

  if (tag === 'p') {
    const inner = serializeNodes(el.childNodes, ctx).trim();
    return inner ? `\n\n${inner}\n\n` : '';
  }

  if (tag === 'blockquote') {
    const inner = serializeNodes(el.childNodes, ctx).trim();
    if (!inner) {
      return '';
    }
    const quoted = inner
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map((line) => (line.trim() === '' ? '>' : `> ${line}`))
      .join('\n');
    return `\n\n${quoted}\n\n`;
  }

  if (tag === 'ul') {
    return serializeList(el, false, ctx);
  }

  if (tag === 'ol') {
    return serializeList(el, true, ctx);
  }

  if (tag === 'table') {
    return serializeTable(el, ctx);
  }

  if (tag === 'strong' || tag === 'b') {
    const fontWeight = (el as HTMLElement).style?.fontWeight;
    if (fontWeight === 'normal' || fontWeight === '400') {
      return serializeNodes(el.childNodes, ctx);
    }
    const inner = serializeNodes(el.childNodes, ctx);
    return wrapWithPreservedOuterSpaces(inner, '**');
  }

  if (tag === 'em' || tag === 'i') {
    const fontStyle = (el as HTMLElement).style?.fontStyle;
    if (fontStyle === 'normal') {
      return serializeNodes(el.childNodes, ctx);
    }
    const inner = serializeNodes(el.childNodes, ctx);
    return wrapWithPreservedOuterSpaces(inner, '*');
  }

  if (tag === 'del' || tag === 's') {
    const inner = serializeNodes(el.childNodes, ctx);
    return wrapWithPreservedOuterSpaces(inner, '~~');
  }

  if (tag === 'a') {
    const href = el.getAttribute('href')?.trim() ?? '';
    const label = serializeNodes(el.childNodes, ctx).trim();
    if (!label && !href) {
      return '';
    }
    if (isSafeHttpUrl(href)) {
      const displayLabel = label || href;
      return `[${displayLabel}](${href})`;
    }
    return label;
  }

  if (tag === 'img') {
    const alt = el.getAttribute('alt')?.trim();
    return alt ? `[imagem: ${alt}]` : '';
  }

  if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'header' || tag === 'footer') {
    const inner = serializeNodes(el.childNodes, ctx);
    const trimmed = inner.trim();
    if (!trimmed) {
      return '';
    }
    return `\n${inner}\n`;
  }

  return serializeNodes(el.childNodes, ctx);
}

function tidyMarkdownOutput(raw: string): string {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const outLines: string[] = [];
  let inFence = false;
  let blankStreak = 0;

  for (const line of lines) {
    if (/^[ \t]*(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence;
      blankStreak = 0;
      outLines.push(line);
      continue;
    }

    if (inFence) {
      outLines.push(line);
      continue;
    }

    const cleanedLine = line.replace(/[ \t]+$/g, '');
    if (cleanedLine.trim() === '') {
      blankStreak += 1;
      if (blankStreak <= 1 && outLines.length > 0) {
        outLines.push('');
      }
      continue;
    }

    blankStreak = 0;
    outLines.push(cleanedLine);
  }

  while (outLines.length > 0 && outLines[outLines.length - 1] === '') {
    outLines.pop();
  }

  return outLines.join('\n').trim();
}

function cleanPlainTextMathMlDuplicates(plainText: string): ExtractCleanPasteResult {
  if (!MATH_ALPHANUMERIC_REGEX.test(plainText)) {
    return { text: plainText, transformed: false };
  }

  const normalizedChars = normalizeMathUnicodeToAscii(
    plainText.replace(/\r\n?/g, '\n')
  );

  // Remove tabs soltos entre quebras de linha e normaliza tabulações espúrias de seleção MathML
  let cleaned = normalizedChars
    .replace(/^[ \t]+$/gm, '')
    .replace(/[ \t]*\t+[ \t]*/g, ' ');

  // Colapsa duplicação adjacente do mesmo token entre quebras de linha: ex. `\nN\nN\n` ou ` 𝑁\nN `
  let previous = '';
  while (previous !== cleaned) {
    previous = cleaned;
    cleaned = cleaned
      .replace(/(^|\n)([^\n]{1,40})\n\2(?=\n|$)/g, '$1$2')
      .replace(/([ \t]|^)([A-Za-z0-9_+\-*/=^()[\]]{1,20})\n\2(?=[ \t\n.,;:!?)]|$)/g, '$1$2');
  }

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  if (cleaned === plainText) {
    return { text: plainText, transformed: false };
  }

  return { text: cleaned, transformed: true };
}

/**
 * Converte HTML rico de área de transferência (KaTeX, MathJax, MathML e HTML semântico)
 * em Markdown + LaTeX limpo, protegendo código copiado de IDEs e texto comum.
 */
export function extractCleanPasteText({
  html,
  plainText,
}: ExtractCleanPasteInput): ExtractCleanPasteResult {
  const trimmedHtml = html.trim();

  if (trimmedHtml.length > 0 && typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(trimmedHtml, 'text/html');
    const body = doc.body;

    if (body) {
      const { hasMath, hasSemanticMarkdown } = hasMathOrSemanticHtml(body);

      if (!hasMath && !hasSemanticMarkdown) {
        return cleanPlainTextMathMlDuplicates(plainText);
      }

      const serialized = serializeNodes(body.childNodes, {
        listDepth: 0,
        consumedNodes: new WeakSet<Node>(),
        inCodeOrPre: false,
      });

      const tidied = tidyMarkdownOutput(serialized);

      if (tidied.length > 0) {
        if (tidied === plainText) {
          return { text: plainText, transformed: false };
        }
        return { text: tidied, transformed: true };
      }
    }
  }

  return cleanPlainTextMathMlDuplicates(plainText);
}
