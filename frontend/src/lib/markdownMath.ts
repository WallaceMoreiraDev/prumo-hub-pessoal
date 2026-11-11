const MATH_ENVIRONMENTS = new Set<string>([
  'cases',
  'dcases',
  'rcases',
  'aligned',
  'align',
  'align*',
  'equation',
  'equation*',
  'gather',
  'gather*',
  'multline',
  'multline*',
  'split',
  'array',
  'matrix',
  'pmatrix',
  'bmatrix',
  'Bmatrix',
  'vmatrix',
  'Vmatrix',
  'smallmatrix',
]);

const MATH_SYNTAX_REGEX =
  /[\\^_=<>+*/{}[\]()]|\|(?!\|)|!(?==)|~|\\[a-zA-Z]+/;

function createSentinelBase(text: string): { prefix: string; suffix: string } {
  let prefix = '\uE000PRUMO_CODE_';
  const suffix = '\uE001';
  while (text.includes(prefix)) {
    prefix += '_';
  }
  return { prefix, suffix };
}

interface CodeShieldResult {
  shielded: string;
  restore: (value: string) => string;
}

/**
 * Protege blocos de código cercados (``` / ~~~) e spans inline (`...`)
 * para que nenhum delimitador matemático ou cifrão dentro de código seja alterado.
 */
function shieldCodeSegments(input: string): CodeShieldResult {
  const { prefix, suffix } = createSentinelBase(input);
  const blocks: string[] = [];

  const pushBlock = (rawCode: string): string => {
    const id = blocks.length;
    blocks.push(rawCode);
    return `${prefix}${id}${suffix}`;
  };

  let out = '';
  let i = 0;

  while (i < input.length) {
    const atLineStart = i === 0 || input[i - 1] === '\n';

    if (atLineStart) {
      const lineEndIdx = input.indexOf('\n', i);
      const rawLine =
        lineEndIdx === -1 ? input.slice(i) : input.slice(i, lineEndIdx);

      const fenceMatch = rawLine.match(
        /^[ \t]*(?:>[ \t]*)*(`{3,}|~{3,})([^\n]*)$/
      );

      if (fenceMatch) {
        const fence = fenceMatch[1] ?? '';
        const info = fenceMatch[2] ?? '';
        const fenceChar = fence[0];

        // No CommonMark, info strings de crase não podem conter crases.
        if (!(fenceChar === '`' && info.includes('`')) && fenceChar) {
          let cursor = lineEndIdx === -1 ? input.length : lineEndIdx + 1;
          let foundCloseEnd = input.length;

          while (cursor < input.length) {
            const nextNl = input.indexOf('\n', cursor);
            const curLine =
              nextNl === -1 ? input.slice(cursor) : input.slice(cursor, nextNl);

            const closePattern = new RegExp(
              `^[ \\t]*(?:>[ \\t]*)*${fenceChar === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`
            );

            if (closePattern.test(curLine)) {
              foundCloseEnd = nextNl === -1 ? input.length : nextNl;
              break;
            }

            if (nextNl === -1) {
              foundCloseEnd = input.length;
              break;
            }
            cursor = nextNl + 1;
          }

          out += pushBlock(input.slice(i, foundCloseEnd));
          i = foundCloseEnd;
          continue;
        }
      }
    }

    // Backticks inline (evita escudos para crase escapada fora de span)
    if (input[i] === '`') {
      let backslashes = 0;
      let b = i - 1;
      while (b >= 0 && input[b] === '\\') {
        backslashes++;
        b--;
      }

      let tickCount = 1;
      while (input[i + tickCount] === '`') {
        tickCount++;
      }

      if (backslashes % 2 === 1 && tickCount === 1) {
        out += '`';
        i += 1;
        continue;
      }

      let k = i + tickCount;
      let closeEnd = -1;

      while (k < input.length) {
        if (
          input[k] === '\n' &&
          k + 1 < input.length &&
          (input[k + 1] === '\n' ||
            /^[ \t]*\n/.test(input.slice(k + 1)))
        ) {
          break;
        }

        if (input[k] === '`') {
          let closeTicks = 1;
          while (input[k + closeTicks] === '`') {
            closeTicks++;
          }
          if (closeTicks === tickCount) {
            closeEnd = k + closeTicks;
            break;
          }
          k += closeTicks;
          continue;
        }

        k++;
      }

      if (closeEnd !== -1) {
        out += pushBlock(input.slice(i, closeEnd));
        i = closeEnd;
        continue;
      }

      out += input.slice(i, i + tickCount);
      i += tickCount;
      continue;
    }

    out += input[i];
    i += 1;
  }

  return {
    shielded: out,
    restore: (value: string) => {
      if (blocks.length === 0) {
        return value;
      }
      const placeholderRegex = new RegExp(
        `${escapeRegExp(prefix)}(\\d+)${escapeRegExp(suffix)}`,
        'g'
      );
      return value.replace(placeholderRegex, (_match, rawIdx: string) => {
        const idx = Number(rawIdx);
        return blocks[idx] ?? '';
      });
    },
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractLineContext(currentLine: string): {
  onlyPrefixOnLine: boolean;
  containerPrefix: string;
} {
  const bqMatch = currentLine.match(/^([ \t]*(?:>[ \t]*)+)(.*)$/);
  if (bqMatch) {
    const rawBq = bqMatch[1] ?? '';
    const rest = bqMatch[2] ?? '';
    const normalizedBq = rawBq.replace(/[ \t]+$/, ' ');
    return {
      onlyPrefixOnLine: /^[ \t]*$/.test(rest),
      containerPrefix: normalizedBq.endsWith(' ')
        ? normalizedBq
        : `${normalizedBq} `,
    };
  }

  const listMatch = currentLine.match(
    /^([ \t]*(?:[-+*]|\d+[.)])[ \t]+)(.*)$/
  );
  if (listMatch) {
    const marker = listMatch[1] ?? '';
    const rest = listMatch[2] ?? '';
    return {
      onlyPrefixOnLine: /^[ \t]*$/.test(rest),
      containerPrefix: ' '.repeat(marker.length),
    };
  }

  const indentMatch = currentLine.match(/^([ \t]+)(.*)$/);
  if (indentMatch) {
    const indent = indentMatch[1] ?? '';
    const rest = indentMatch[2] ?? '';
    return {
      onlyPrefixOnLine: rest.length === 0,
      containerPrefix: indent,
    };
  }

  return {
    onlyPrefixOnLine: currentLine.length === 0,
    containerPrefix: '',
  };
}

function stripBlockquotePrefixFromLines(
  inner: string,
  hasBlockquotePrefix: boolean
): string {
  const lines = inner.split('\n');
  const cleaned = lines.map((line) => {
    if (!hasBlockquotePrefix) {
      return line;
    }
    return line.replace(/^[ \t]*>[ \t]?/, '');
  });

  while (cleaned.length > 0 && cleaned[0]?.trim() === '') {
    cleaned.shift();
  }
  while (cleaned.length > 0 && cleaned[cleaned.length - 1]?.trim() === '') {
    cleaned.pop();
  }

  // Remove indentação comum se for um bloco indentado uniformemente
  const nonEmptyIndents = cleaned
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^[ \t]*/)?.[0].length ?? 0);
  const minIndent =
    nonEmptyIndents.length > 0 ? Math.min(...nonEmptyIndents) : 0;

  const normalizedLines =
    minIndent > 0 ? cleaned.map((line) => line.slice(minIndent)) : cleaned;

  return normalizedLines.map((line) => line.replace(/[ \t]+$/, '')).join('\n');
}

function isInTableRow(text: string, startIdx: number, endIdx: number): boolean {
  const lineStart = text.lastIndexOf('\n', startIdx - 1) + 1;
  const lineBefore = text.slice(lineStart, startIdx);

  const lineEndNl = text.indexOf('\n', endIdx);
  const lineEnd = lineEndNl === -1 ? text.length : lineEndNl;
  const lineAfter = text.slice(endIdx, lineEnd);

  return lineBefore.includes('|') || lineAfter.includes('|');
}

function hasMathSyntax(value: string): boolean {
  return MATH_SYNTAX_REGEX.test(value);
}

function isLikelyCurrencyPair(
  rawCandidate: string,
  afterClose: string
): boolean {
  // Ex.: $100 e $200, $10 e $20 reais, $200, onde $x = 1$
  if (!/^\s*\d+(?:[.,]\d+)?(?:\s|[,.;:!?]|$)/.test(rawCandidate)) {
    return false;
  }

  if (hasMathSyntax(rawCandidate)) {
    return false;
  }

  if (/^\s*\d+(?:[.,]\d+)?(?:[,.;:!?]*\s+[a-zA-ZÀ-ÿ]+)/.test(rawCandidate)) {
    return true;
  }

  if (/\s/.test(rawCandidate) && /^\s*\d/.test(afterClose)) {
    return true;
  }

  return false;
}

function isLikelyProseBetweenBareDollars(trimmed: string): boolean {
  if (trimmed.length === 0) {
    return true;
  }
  if (hasMathSyntax(trimmed)) {
    return false;
  }
  // Múltiplas palavras comuns em caixa baixa sem sintaxe matemática indicam falso positivo
  const words = trimmed.split(/\s+/);
  if (words.length >= 2 && words.every((w) => /^[a-zà-öø-ÿ,.;:!?-]+$/i.test(w))) {
    // Permite combinações curtas como "N log N" onde haja maiúscula ou termo algébrico;
    // se todas forem palavras minúsculas comuns longas (>= 3 chars), evita falso positivo.
    const allLongLowercase = words.every(
      (w) => w.length >= 3 && w === w.toLowerCase()
    );
    if (allLongLowercase) {
      return true;
    }
  }
  return false;
}

function findClosingInlineParen(text: string, openIdx: number): number {
  let j = openIdx + 2;
  while (j < text.length) {
    if (text[j] === '\\') {
      if (text[j + 1] === ')') {
        return j;
      }
      j += 2;
      continue;
    }
    if (text[j] === '\n' && text[j + 1] === '\n') {
      return -1;
    }
    j += 1;
  }
  return -1;
}

function findClosingDisplayBracket(text: string, openIdx: number): number {
  let j = openIdx + 2;
  while (j < text.length) {
    if (text[j] === '\\') {
      if (text[j + 1] === ']') {
        return j;
      }
      j += 2;
      continue;
    }
    j += 1;
  }
  return -1;
}

function findClosingDoubleDollar(text: string, openIdx: number): number {
  let j = openIdx + 2;
  while (j < text.length) {
    if (text[j] === '\\') {
      j += 2;
      continue;
    }
    if (text[j] === '$' && text[j + 1] === '$') {
      return j;
    }
    j += 1;
  }
  return -1;
}

function findClosingMathEnv(
  text: string,
  openIdx: number,
  envName: string
): number {
  const escapedEnv = escapeRegExp(envName);
  const envRegex = new RegExp(`\\\\(begin|end)\\{${escapedEnv}\\}`, 'g');
  envRegex.lastIndex = openIdx;

  let depth = 0;
  let match: RegExpExecArray | null = envRegex.exec(text);
  while (match !== null) {
    // Garante que não está escapado por número ímpar de barras antes
    let backslashes = 0;
    let k = match.index - 1;
    while (k >= 0 && text[k] === '\\') {
      backslashes++;
      k--;
    }

    if (backslashes % 2 === 0) {
      if (match[1] === 'begin') {
        depth += 1;
      } else {
        depth -= 1;
        if (depth === 0) {
          return match.index + match[0].length;
        }
      }
    }

    match = envRegex.exec(text);
  }

  return -1;
}

function findClosingSingleDollar(text: string, openIdx: number): number {
  let j = openIdx + 1;
  while (j < text.length) {
    if (text[j] === '\\') {
      j += 2;
      continue;
    }

    if (text[j] === '\n') {
      const rest = text.slice(j + 1);
      if (text[j + 1] === '\n' || /^[ \t]*\n/.test(rest)) {
        return -1;
      }
    }

    if (text[j] === '$') {
      if (text[j + 1] === '$') {
        return -1;
      }
      return j;
    }

    j += 1;
  }
  return -1;
}

/**
 * Normaliza conteúdo misto de Markdown + múltiplos dialetos LaTeX (`$...$`, `$$...$$`,
 * `\(...\)`, `\[...\]`, ambientes `\begin{cases}...\end{cases}`) e protege moedas e
 * blocos/spans de código antes da renderização com `react-markdown` + `remark-math`.
 */
export function prepareMarkdownMathContent(raw: string): string {
  if (!raw) {
    return '';
  }

  const normalizedNewlines = raw.replace(/\r\n?/g, '\n');
  if (normalizedNewlines.trim().length === 0) {
    return '';
  }

  const { shielded, restore } = shieldCodeSegments(normalizedNewlines);

  let out = '';
  let i = 0;

  const emitDisplayBlock = (
    rawInner: string,
    tokenEndIdx: number
  ): number => {
    const inTable = isInTableRow(shielded, i, tokenEndIdx);
    const outLineStart = out.lastIndexOf('\n') + 1;
    const currentOutLine = out.slice(outLineStart);
    const lineCtx = extractLineContext(currentOutLine);
    const hasBlockquote = lineCtx.containerPrefix.includes('>');

    const cleanedInner = stripBlockquotePrefixFromLines(
      rawInner,
      hasBlockquote
    );

    if (inTable) {
      const singleLine = cleanedInner.replace(/\s*\n\s*/g, ' ').trim();
      out += `$$${singleLine}$$`;
      return tokenEndIdx;
    }

    const prefix = lineCtx.containerPrefix;
    const innerLines = cleanedInner
      .split('\n')
      .map((line) => (prefix ? `${prefix}${line}` : line))
      .join('\n');

    if (lineCtx.onlyPrefixOnLine) {
      // Substitui espaços soltos se não houver prefixo estrutural, mantendo > ou indent de lista
      if (prefix) {
        out = out.slice(0, outLineStart) + prefix;
      } else {
        out = out.slice(0, outLineStart);
      }
      out += `$$\n${innerLines}\n${prefix}$$`;
    } else {
      out = out.replace(/[ \t]+$/, '');
      out += `\n${prefix}$$\n${innerLines}\n${prefix}$$`;
    }

    // Verifica o que vem após o delimitador de fechamento na mesma linha
    let nextIdx = tokenEndIdx;
    while (
      nextIdx < shielded.length &&
      (shielded[nextIdx] === ' ' || shielded[nextIdx] === '\t')
    ) {
      nextIdx++;
    }

    if (nextIdx < shielded.length && shielded[nextIdx] !== '\n') {
      out += `\n${prefix}`;
      return nextIdx;
    }

    return tokenEndIdx;
  };

  while (i < shielded.length) {
    const ch = shielded[i];

    if (ch === '\\') {
      const next = shielded[i + 1];

      if (next === '\\' || next === '$' || next === ')' || next === ']') {
        out += ch + next;
        i += 2;
        continue;
      }

      if (next === '(') {
        const closeIdx = findClosingInlineParen(shielded, i);
        if (closeIdx !== -1) {
          const inner = shielded
            .slice(i + 2, closeIdx)
            .trim()
            .replace(/\s*\n\s*/g, ' ');
          if (inner.length > 0) {
            out += `$${inner}$`;
          } else {
            out += '\\(\\)';
          }
          i = closeIdx + 2;
          continue;
        }
        out += '\\(';
        i += 2;
        continue;
      }

      if (next === '[') {
        const closeIdx = findClosingDisplayBracket(shielded, i);
        if (closeIdx !== -1) {
          const rawInner = shielded.slice(i + 2, closeIdx);
          i = emitDisplayBlock(rawInner, closeIdx + 2);
          continue;
        }
        out += '\\[';
        i += 2;
        continue;
      }

      if (shielded.startsWith('\\begin{', i)) {
        const envMatch = shielded.slice(i).match(/^\\begin\{([a-zA-Z*]+)\}/);
        const envName = envMatch?.[1];
        if (envName && MATH_ENVIRONMENTS.has(envName)) {
          const closeEnd = findClosingMathEnv(shielded, i, envName);
          if (closeEnd !== -1) {
            const fullEnv = shielded.slice(i, closeEnd);
            i = emitDisplayBlock(fullEnv, closeEnd);
            continue;
          }
        }
      }

      out += ch;
      i += 1;
      continue;
    }

    if (ch === '$') {
      // Bloco $$...$$
      if (shielded[i + 1] === '$') {
        const closeIdx = findClosingDoubleDollar(shielded, i);
        if (closeIdx !== -1) {
          const rawInner = shielded.slice(i + 2, closeIdx);
          i = emitDisplayBlock(rawInner, closeIdx + 2);
          continue;
        }
        out += '$$';
        i += 2;
        continue;
      }

      // Proteção contra prefixos explícitos de moeda: R$ 100, US$ 50, U$ 20, USD$ 10, BRL$ 10
      const lookbehind = out.slice(Math.max(0, out.length - 8));
      if (
        /(?:^|[\s([{"'—–-])(?:R|US|U|USD|BRL|CAD|AUD|EUR)$/.test(lookbehind) &&
        /^[ \t]*(?:\d|[,.;:!?)}\]]|$)/.test(shielded.slice(i + 1))
      ) {
        out += '\\$';
        i += 1;
        continue;
      }

      const closeIdx = findClosingSingleDollar(shielded, i);
      if (closeIdx !== -1) {
        const rawCandidate = shielded.slice(i + 1, closeIdx);
        const afterClose = shielded.slice(closeIdx + 1);

        if (isLikelyCurrencyPair(rawCandidate, afterClose)) {
          out += '\\$';
          i += 1;
          continue;
        }

        const trimmed = rawCandidate.trim();
        if (rawCandidate !== trimmed && !rawCandidate.includes('\n')) {
          if (isLikelyProseBetweenBareDollars(trimmed)) {
            out += '\\$';
            i += 1;
            continue;
          }
          out += `$${trimmed}$`;
          i = closeIdx + 1;
          continue;
        }

        if (
          rawCandidate.trim().length > 0 &&
          !(isLikelyProseBetweenBareDollars(trimmed) && /\s/.test(rawCandidate))
        ) {
          out += `$${rawCandidate}$`;
          i = closeIdx + 1;
          continue;
        }

        out += '\\$';
        i += 1;
        continue;
      }

      // Cifrão isolado antes de número sem par no parágrafo -> escapa preventivamente
      if (/^\s*\d/.test(shielded.slice(i + 1))) {
        out += '\\$';
        i += 1;
        continue;
      }

      out += '$';
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return restore(out);
}
