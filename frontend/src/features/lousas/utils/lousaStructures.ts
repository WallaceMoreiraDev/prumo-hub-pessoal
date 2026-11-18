import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawLinearElement } from '@excalidraw/excalidraw/element/types';

export interface LousaViewportOrigin {
  originX: number;
  originY: number;
}

export const MATRIX_MIN_DIMENSION = 1;
export const MATRIX_MAX_DIMENSION = 8;

export const TABLE_MIN_ROWS = 2;
export const TABLE_MAX_ROWS = 10;
export const TABLE_MIN_COLS = 2;
export const TABLE_MAX_COLS = 8;

export const GRAPH_MIN_PRESET_NODES = 2;
export const GRAPH_MAX_PRESET_NODES = 12;
export const GRAPH_COMPLETE_LAYOUT_MAX_NODES = 8;
export const GRAPH_MAX_EDGE_LIST_NODES = 16;
export const GRAPH_MAX_EDGE_LIST_EDGES = 40;

export const CARTESIAN_MIN_RANGE = 3;
export const CARTESIAN_MAX_RANGE = 10;

// Paleta base clara canônica do Excalidraw (o Excalidraw aplica inversão automática no Dark Mode).
const EXCALIDRAW_STROKE_PRIMARY = '#1e1e1e';
const EXCALIDRAW_STROKE_SUBTLE = '#868e96';
const EXCALIDRAW_GRID_STROKE = '#ced4da';
const EXCALIDRAW_HEADER_BG = '#e9ecef';
const EXCALIDRAW_NODE_BG = '#ffffff';
const EXCALIDRAW_TRANSPARENT = 'transparent';
const STRUCTURE_FONT_FAMILY = 2 as const; // Helvetica (sans nítida para fórmulas e rótulos)
const PROPORTIONAL_ROUNDNESS_TYPE = 2 as const; // ROUNDNESS.PROPORTIONAL_RADIUS

type LinearPoints = ExcalidrawLinearElement['points'];
type LinearPoint = LinearPoints[number];

let uniqueSequence = 0;

function createUniqueId(prefix: string): string {
  uniqueSequence += 1;
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${uniqueSequence.toString(36)}`;
}

function toLocalPoints(
  coords: ReadonlyArray<readonly [number, number]>
): LinearPoints {
  return coords.map(([px, py]) => [px, py] as unknown as LinearPoint);
}

function clampInt(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function estimateCenteredTextPos(
  centerX: number,
  centerY: number,
  text: string,
  fontSize: number
): { x: number; y: number } {
  const approxWidth = Math.max(fontSize * 0.6, text.length * fontSize * 0.58);
  const approxHeight = fontSize * 1.25;
  return {
    x: centerX - approxWidth / 2,
    y: centerY - approxHeight / 2,
  };
}

// ============================================================================
// 1. MATRIZ
// ============================================================================

export type MatrixDelimiter = 'brackets' | 'parens' | 'bars';
export type MatrixPreset = 'blank' | 'zeros' | 'identity';

export interface BuildMatrixOptions extends LousaViewportOrigin {
  rows?: number;
  cols?: number;
  delimiter?: MatrixDelimiter;
  preset?: MatrixPreset;
}

/**
 * Gera esqueleto Excalidraw de uma matriz com delimitadores agrupados
 * e grade uniforme de células centrada em `{ originX, originY }`.
 */
export function buildMatrixSkeleton(
  options: BuildMatrixOptions
): ExcalidrawElementSkeleton[] {
  const rows = clampInt(
    options.rows,
    MATRIX_MIN_DIMENSION,
    MATRIX_MAX_DIMENSION,
    3
  );
  const cols = clampInt(
    options.cols,
    MATRIX_MIN_DIMENSION,
    MATRIX_MAX_DIMENSION,
    3
  );
  const delimiter: MatrixDelimiter = options.delimiter ?? 'brackets';
  const preset: MatrixPreset = options.preset ?? 'blank';

  const cellWidth = 56;
  const cellHeight = 44;
  const gapX = 8;
  const gapY = 8;

  const gridWidth = cols * cellWidth + (cols - 1) * gapX;
  const gridHeight = rows * cellHeight + (rows - 1) * gapY;
  const delimiterPadY = 10;
  const delimiterGap = 16;
  const delimiterWidth = 14;
  const totalHeight = gridHeight + delimiterPadY * 2;

  const startX = options.originX - gridWidth / 2;
  const startY = options.originY - gridHeight / 2;
  const topY = startY - delimiterPadY;
  const leftDelimiterX = startX - delimiterGap - delimiterWidth;
  const rightDelimiterX = startX + gridWidth + delimiterGap;

  const delimiterGroupId = createUniqueId('matrix-delim-group');
  const elements: ExcalidrawElementSkeleton[] = [];

  elements.push(
    ...buildMatrixDelimiterPair({
      delimiter,
      leftX: leftDelimiterX,
      rightX: rightDelimiterX,
      topY,
      width: delimiterWidth,
      height: totalHeight,
      groupId: delimiterGroupId,
    })
  );

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cellX = startX + col * (cellWidth + gapX);
      const cellY = startY + row * (cellHeight + gapY);

      if (preset === 'blank') {
        elements.push({
          id: createUniqueId(`matrix-cell-${row}-${col}`),
          type: 'rectangle',
          x: cellX,
          y: cellY,
          width: cellWidth,
          height: cellHeight,
          roughness: 0,
          roundness: null,
          strokeWidth: 1,
          strokeStyle: 'dashed',
          strokeColor: EXCALIDRAW_GRID_STROKE,
          backgroundColor: EXCALIDRAW_TRANSPARENT,
          opacity: 65,
        });
        continue;
      }

      const value =
        preset === 'identity' ? (row === col ? '1' : '0') : '0';
      const fontSize = 22;
      const textPos = estimateCenteredTextPos(
        cellX + cellWidth / 2,
        cellY + cellHeight / 2,
        value,
        fontSize
      );

      elements.push({
        id: createUniqueId(`matrix-val-${row}-${col}`),
        type: 'text',
        x: textPos.x,
        y: textPos.y,
        text: value,
        fontSize,
        fontFamily: STRUCTURE_FONT_FAMILY,
        textAlign: 'center',
        verticalAlign: 'middle',
        strokeColor: EXCALIDRAW_STROKE_PRIMARY,
      });
    }
  }

  return elements;
}

function buildMatrixDelimiterPair(params: {
  delimiter: MatrixDelimiter;
  leftX: number;
  rightX: number;
  topY: number;
  width: number;
  height: number;
  groupId: string;
}): ExcalidrawElementSkeleton[] {
  const { delimiter, leftX, rightX, topY, width, height, groupId } = params;

  if (delimiter === 'bars') {
    const centerOffset = width / 2;
    return [
      {
        id: createUniqueId('matrix-bar-left'),
        type: 'line',
        x: leftX + centerOffset,
        y: topY,
        points: toLocalPoints([
          [0, 0],
          [0, height],
        ]),
        roughness: 0,
        roundness: null,
        strokeWidth: 2,
        strokeColor: EXCALIDRAW_STROKE_PRIMARY,
        groupIds: [groupId],
      },
      {
        id: createUniqueId('matrix-bar-right'),
        type: 'line',
        x: rightX + centerOffset,
        y: topY,
        points: toLocalPoints([
          [0, 0],
          [0, height],
        ]),
        roughness: 0,
        roundness: null,
        strokeWidth: 2,
        strokeColor: EXCALIDRAW_STROKE_PRIMARY,
        groupIds: [groupId],
      },
    ];
  }

  if (delimiter === 'parens') {
    const segments = 12;
    const curveW = Math.min(18, Math.max(width, height * 0.075));
    const leftPoints: Array<readonly [number, number]> = [];
    const rightPoints: Array<readonly [number, number]> = [];

    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const u = 2 * t - 1; // [-1, 1]
      const y = height * t;
      leftPoints.push([curveW * u * u, y]);
      rightPoints.push([curveW * (1 - u * u), y]);
    }

    return [
      {
        id: createUniqueId('matrix-paren-left'),
        type: 'line',
        x: leftX,
        y: topY,
        points: toLocalPoints(leftPoints),
        roughness: 0,
        roundness: { type: PROPORTIONAL_ROUNDNESS_TYPE },
        strokeWidth: 2,
        strokeColor: EXCALIDRAW_STROKE_PRIMARY,
        groupIds: [groupId],
      },
      {
        id: createUniqueId('matrix-paren-right'),
        type: 'line',
        x: rightX + width - curveW,
        y: topY,
        points: toLocalPoints(rightPoints),
        roughness: 0,
        roundness: { type: PROPORTIONAL_ROUNDNESS_TYPE },
        strokeWidth: 2,
        strokeColor: EXCALIDRAW_STROKE_PRIMARY,
        groupIds: [groupId],
      },
    ];
  }

  // 'brackets' ([ ])
  const hookW = Math.min(12, width);
  return [
    {
      id: createUniqueId('matrix-bracket-left'),
      type: 'line',
      x: leftX,
      y: topY,
      points: toLocalPoints([
        [hookW, 0],
        [0, 0],
        [0, height],
        [hookW, height],
      ]),
      roughness: 0,
      roundness: null,
      strokeWidth: 2,
      strokeColor: EXCALIDRAW_STROKE_PRIMARY,
      groupIds: [groupId],
    },
    {
      id: createUniqueId('matrix-bracket-right'),
      type: 'line',
      x: rightX,
      y: topY,
      points: toLocalPoints([
        [0, 0],
        [hookW, 0],
        [hookW, height],
        [0, height],
      ]),
      roughness: 0,
      roundness: null,
      strokeWidth: 2,
      strokeColor: EXCALIDRAW_STROKE_PRIMARY,
      groupIds: [groupId],
    },
  ];
}

// ============================================================================
// 2. TABELA
// ============================================================================

export interface BuildTableOptions extends LousaViewportOrigin {
  rows?: number;
  cols?: number;
  hasHeader?: boolean;
  cellWidth?: number;
  cellHeight?: number;
}

/**
 * Gera uma grade tabular alinhada pixel a pixel com células prontas para
 * escrita manual ou edição por duplo clique, com cabeçalho opcional destacado.
 */
export function buildTableSkeleton(
  options: BuildTableOptions
): ExcalidrawElementSkeleton[] {
  const rows = clampInt(options.rows, TABLE_MIN_ROWS, TABLE_MAX_ROWS, 4);
  const cols = clampInt(options.cols, TABLE_MIN_COLS, TABLE_MAX_COLS, 3);
  const hasHeader = options.hasHeader ?? true;
  const cellWidth = clampInt(options.cellWidth, 64, 220, 110);
  const cellHeight = clampInt(options.cellHeight, 32, 96, 44);

  const totalWidth = cols * cellWidth;
  const totalHeight = rows * cellHeight;
  const startX = options.originX - totalWidth / 2;
  const startY = options.originY - totalHeight / 2;

  const elements: ExcalidrawElementSkeleton[] = [];

  for (let row = 0; row < rows; row += 1) {
    const isHeaderRow = hasHeader && row === 0;
    for (let col = 0; col < cols; col += 1) {
      const baseCell = {
        id: createUniqueId(`table-cell-${row}-${col}`),
        type: 'rectangle' as const,
        x: startX + col * cellWidth,
        y: startY + row * cellHeight,
        width: cellWidth,
        height: cellHeight,
        roughness: 0,
        roundness: null,
        strokeWidth: 1,
        strokeColor: EXCALIDRAW_STROKE_PRIMARY,
        fillStyle: 'solid' as const,
      };

      if (isHeaderRow) {
        elements.push({
          ...baseCell,
          backgroundColor: EXCALIDRAW_HEADER_BG,
          label: {
            text: `Col ${col + 1}`,
            fontSize: 16,
            fontFamily: STRUCTURE_FONT_FAMILY,
            strokeColor: EXCALIDRAW_STROKE_PRIMARY,
            textAlign: 'center',
            verticalAlign: 'middle',
          },
        });
      } else {
        elements.push({
          ...baseCell,
          backgroundColor: EXCALIDRAW_TRANSPARENT,
        });
      }
    }
  }

  return elements;
}

// ============================================================================
// 3. GRAFO + PARSER DE LISTA DE ARESTAS
// ============================================================================

export interface ParsedGraphEdge {
  from: string;
  to: string;
}

export interface GraphParseResult {
  ok: boolean;
  nodes: string[];
  edges: ParsedGraphEdge[];
  error: string | null;
}

const ARROW_EDGE_PATTERN = /^([^\s\->,;]+)\s*->\s*([^\s\->,;]+)$/;
const DASH_EDGE_PATTERN = /^([^\s\->,;]+)\s*[-–]\s*([^\s\->,;]+)$/;
const SPACE_EDGE_PATTERN = /^([^\s\->,;]+)\s+([^\s\->,;]+)$/;
const SINGLE_NODE_PATTERN = /^([^\s\->,;]+)$/;

/**
 * Faz o parse de lista de arestas/vértices isolados para construção de grafos.
 * Suporta vírgula, ponto e vírgula ou quebra de linha, e formatos `1-2`, `1->2`, `A-B`, `0 1`.
 */
export function parseGraphEdgeList(
  rawInput: string,
  options?: { directed?: boolean }
): GraphParseResult {
  const directed = options?.directed ?? false;
  const trimmed = rawInput.trim();

  if (!trimmed) {
    return {
      ok: false,
      nodes: [],
      edges: [],
      error: 'Informe ao menos um vértice ou aresta (ex.: 1-2, 2-3, 1-4).',
    };
  }

  const tokens = trimmed
    .split(/[,;\r\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (tokens.length === 0) {
    return {
      ok: false,
      nodes: [],
      edges: [],
      error: 'Informe ao menos um vértice ou aresta (ex.: 1-2, 2-3, 1-4).',
    };
  }

  const nodeOrder: string[] = [];
  const nodeSet = new Set<string>();
  const edges: ParsedGraphEdge[] = [];
  const edgeKeys = new Set<string>();

  function registerNode(label: string): void {
    if (!nodeSet.has(label)) {
      nodeSet.add(label);
      nodeOrder.push(label);
    }
  }

  for (const token of tokens) {
    const arrowMatch = ARROW_EDGE_PATTERN.exec(token);
    const dashMatch = !arrowMatch ? DASH_EDGE_PATTERN.exec(token) : null;
    const spaceMatch =
      !arrowMatch && !dashMatch ? SPACE_EDGE_PATTERN.exec(token) : null;
    const edgeMatch = arrowMatch ?? dashMatch ?? spaceMatch;

    if (edgeMatch) {
      const from = edgeMatch[1];
      const to = edgeMatch[2];
      if (!from || !to) {
        continue;
      }

      if (from.length > 16 || to.length > 16) {
        return {
          ok: false,
          nodes: [],
          edges: [],
          error: `Rótulo muito longo em "${token}". Use até 16 caracteres por vértice.`,
        };
      }

      if (from === to) {
        return {
          ok: false,
          nodes: [],
          edges: [],
          error: `Autolaço não suportado em "${token}". Conecte vértices distintos.`,
        };
      }

      registerNode(from);
      registerNode(to);

      const dedupeKey = directed
        ? `${from}\0${to}`
        : from < to
          ? `${from}\0${to}`
          : `${to}\0${from}`;

      if (!edgeKeys.has(dedupeKey)) {
        edgeKeys.add(dedupeKey);
        edges.push({ from, to });
      }
      continue;
    }

    const singleMatch = SINGLE_NODE_PATTERN.exec(token);
    const singleLabel = singleMatch?.[1];
    if (singleLabel) {
      if (singleLabel.length > 16) {
        return {
          ok: false,
          nodes: [],
          edges: [],
          error: `Rótulo muito longo em "${token}". Use até 16 caracteres por vértice.`,
        };
      }
      registerNode(singleLabel);
      continue;
    }

    return {
      ok: false,
      nodes: [],
      edges: [],
      error: `Formato inválido em "${token}". Use exemplos como 1-2, 1->2 ou 0 1 por linha.`,
    };
  }

  if (nodeOrder.length > GRAPH_MAX_EDGE_LIST_NODES) {
    return {
      ok: false,
      nodes: nodeOrder,
      edges,
      error: `Limite de ${GRAPH_MAX_EDGE_LIST_NODES} vértices excedido (${nodeOrder.length} detectados).`,
    };
  }

  if (edges.length > GRAPH_MAX_EDGE_LIST_EDGES) {
    return {
      ok: false,
      nodes: nodeOrder,
      edges,
      error: `Limite de ${GRAPH_MAX_EDGE_LIST_EDGES} arestas excedido (${edges.length} detectadas).`,
    };
  }

  return {
    ok: true,
    nodes: nodeOrder,
    edges,
    error: null,
  };
}

export type GraphMode = 'preset' | 'edge-list';
export type GraphLabelStyle = 'one-based' | 'zero-based' | 'letters';
export type GraphLayout =
  | 'circle'
  | 'tree'
  | 'path'
  | 'grid'
  | 'complete'
  | 'nodes-only';

export interface BuildGraphOptions extends LousaViewportOrigin {
  mode?: GraphMode;
  directed?: boolean;
  nodeCount?: number;
  labelStyle?: GraphLabelStyle;
  layout?: GraphLayout;
  edgeListText?: string;
}

interface Point2D {
  x: number;
  y: number;
}

function buildPresetNodeLabels(
  count: number,
  labelStyle: GraphLabelStyle
): string[] {
  return Array.from({ length: count }, (_, index) => {
    if (labelStyle === 'zero-based') {
      return String(index);
    }
    if (labelStyle === 'letters') {
      return String.fromCharCode(65 + (index % 26));
    }
    return String(index + 1);
  });
}

function buildPresetEdges(
  labels: readonly string[],
  layout: GraphLayout
): ParsedGraphEdge[] {
  const n = labels.length;
  const edges: ParsedGraphEdge[] = [];

  if (layout === 'nodes-only' || n < 2) {
    return edges;
  }

  function pushPair(fromIdx: number, toIdx: number): void {
    const from = labels[fromIdx];
    const to = labels[toIdx];
    if (from !== undefined && to !== undefined) {
      edges.push({ from, to });
    }
  }

  if (layout === 'path') {
    for (let i = 0; i < n - 1; i += 1) {
      pushPair(i, i + 1);
    }
    return edges;
  }

  if (layout === 'tree') {
    for (let i = 1; i < n; i += 1) {
      const parentIndex = Math.floor((i - 1) / 2);
      pushPair(parentIndex, i);
    }
    return edges;
  }

  if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt(n));
    for (let i = 0; i < n; i += 1) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      if (col + 1 < cols && i + 1 < n) {
        pushPair(i, i + 1);
      }
      if (i + cols < n && Math.floor((i + cols) / cols) === row + 1) {
        pushPair(i, i + cols);
      }
    }
    return edges;
  }

  if (layout === 'complete') {
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        pushPair(i, j);
      }
    }
    return edges;
  }

  // 'circle'
  for (let i = 0; i < n - 1; i += 1) {
    pushPair(i, i + 1);
  }
  if (n > 2) {
    pushPair(n - 1, 0);
  }
  return edges;
}

function computeCircleLayout(
  nodes: readonly string[],
  originX: number,
  originY: number
): Map<string, Point2D> {
  const positions = new Map<string, Point2D>();
  const n = nodes.length;
  const firstNode = nodes[0];
  if (n === 1 && firstNode !== undefined) {
    positions.set(firstNode, { x: originX, y: originY });
    return positions;
  }

  const radius = Math.max(105, (n * 96) / (2 * Math.PI));
  nodes.forEach((label, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / n;
    positions.set(label, {
      x: originX + Math.cos(angle) * radius,
      y: originY + Math.sin(angle) * radius,
    });
  });
  return positions;
}

function computePathLayout(
  nodes: readonly string[],
  originX: number,
  originY: number
): Map<string, Point2D> {
  const positions = new Map<string, Point2D>();
  const stepX = 112;
  const totalWidth = (nodes.length - 1) * stepX;
  const startX = originX - totalWidth / 2;

  nodes.forEach((label, index) => {
    positions.set(label, {
      x: startX + index * stepX,
      y: originY,
    });
  });
  return positions;
}

function computeGridLayout(
  nodes: readonly string[],
  originX: number,
  originY: number
): Map<string, Point2D> {
  const positions = new Map<string, Point2D>();
  const n = nodes.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const stepX = 116;
  const stepY = 112;
  const startX = originX - ((cols - 1) * stepX) / 2;
  const startY = originY - ((rows - 1) * stepY) / 2;

  nodes.forEach((label, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    positions.set(label, {
      x: startX + col * stepX,
      y: startY + row * stepY,
    });
  });
  return positions;
}

function computeBfsTreeLayout(
  nodes: readonly string[],
  edges: readonly ParsedGraphEdge[],
  originX: number,
  originY: number
): Map<string, Point2D> {
  const positions = new Map<string, Point2D>();
  if (nodes.length === 0) {
    return positions;
  }

  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    adj.set(node, []);
  }
  for (const edge of edges) {
    adj.get(edge.from)?.push(edge.to);
    adj.get(edge.to)?.push(edge.from);
  }

  const levelByNode = new Map<string, number>();
  let nextComponentStartLevel = 0;

  // BFS a partir do 1º vértice (e componentes desconexos abaixo sem sobreposição).
  for (const candidateRoot of nodes) {
    if (levelByNode.has(candidateRoot)) {
      continue;
    }

    const queue: string[] = [candidateRoot];
    levelByNode.set(candidateRoot, nextComponentStartLevel);
    let maxComponentLevel = nextComponentStartLevel;

    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head];
      if (!current) {
        continue;
      }
      const currentLevel = levelByNode.get(current) ?? nextComponentStartLevel;
      const neighbors = adj.get(current) ?? [];

      for (const neighbor of neighbors) {
        if (!levelByNode.has(neighbor)) {
          const nextLevel = currentLevel + 1;
          levelByNode.set(neighbor, nextLevel);
          if (nextLevel > maxComponentLevel) {
            maxComponentLevel = nextLevel;
          }
          queue.push(neighbor);
        }
      }
    }

    nextComponentStartLevel = maxComponentLevel + 1;
  }

  const layers = new Map<number, string[]>();
  let maxDepth = 0;
  for (const node of nodes) {
    const depth = levelByNode.get(node) ?? 0;
    if (depth > maxDepth) {
      maxDepth = depth;
    }
    const bucket = layers.get(depth);
    if (bucket) {
      bucket.push(node);
    } else {
      layers.set(depth, [node]);
    }
  }

  const stepX = 112;
  const stepY = 110;
  const startY = originY - (maxDepth * stepY) / 2;

  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const rowNodes = layers.get(depth) ?? [];
    const rowWidth = Math.max(0, rowNodes.length - 1) * stepX;
    const rowStartX = originX - rowWidth / 2;

    rowNodes.forEach((node, index) => {
      positions.set(node, {
        x: rowStartX + index * stepX,
        y: startY + depth * stepY,
      });
    });
  }

  return positions;
}

/**
 * Gera esqueleto Excalidraw para grafos em modo preset ou lista de arestas,
 * conectando cada aresta aos nós com IDs únicos determinísticos por inserção.
 */
export function buildGraphSkeleton(
  options: BuildGraphOptions
): ExcalidrawElementSkeleton[] {
  const mode: GraphMode = options.mode ?? 'preset';
  const directed = options.directed ?? false;

  let nodes: string[];
  let edges: ParsedGraphEdge[];
  let effectiveLayout: GraphLayout;

  if (mode === 'edge-list') {
    const parsed = parseGraphEdgeList(options.edgeListText ?? '', { directed });
    if (!parsed.ok) {
      throw new Error(parsed.error ?? 'Lista de arestas inválida.');
    }
    nodes = parsed.nodes;
    edges = parsed.edges;
    effectiveLayout =
      options.layout === 'tree' || options.layout === 'grid'
        ? options.layout
        : 'circle';
  } else {
    const rawLayout = options.layout ?? 'circle';
    effectiveLayout = rawLayout;
    const maxNodes =
      rawLayout === 'complete'
        ? GRAPH_COMPLETE_LAYOUT_MAX_NODES
        : GRAPH_MAX_PRESET_NODES;
    const nodeCount = clampInt(
      options.nodeCount,
      GRAPH_MIN_PRESET_NODES,
      maxNodes,
      5
    );
    const labelStyle: GraphLabelStyle = options.labelStyle ?? 'one-based';
    nodes = buildPresetNodeLabels(nodeCount, labelStyle);
    edges = buildPresetEdges(nodes, rawLayout);
  }

  let positions: Map<string, Point2D>;
  if (effectiveLayout === 'tree') {
    positions = computeBfsTreeLayout(
      nodes,
      edges,
      options.originX,
      options.originY
    );
  } else if (effectiveLayout === 'grid') {
    positions = computeGridLayout(nodes, options.originX, options.originY);
  } else if (effectiveLayout === 'path') {
    positions = computePathLayout(nodes, options.originX, options.originY);
  } else {
    positions = computeCircleLayout(nodes, options.originX, options.originY);
  }

  const nodeSize = 56;
  const nodeRadius = nodeSize / 2;
  const edgePadding = nodeRadius + 4;
  const nodeIdByLabel = new Map<string, string>();
  const elements: ExcalidrawElementSkeleton[] = [];

  nodes.forEach((label, index) => {
    const center = positions.get(label) ?? {
      x: options.originX,
      y: options.originY,
    };
    const nodeId = createUniqueId(`graph-node-${index}`);
    nodeIdByLabel.set(label, nodeId);

    elements.push({
      id: nodeId,
      type: 'ellipse',
      x: center.x - nodeRadius,
      y: center.y - nodeRadius,
      width: nodeSize,
      height: nodeSize,
      roughness: 0,
      strokeWidth: 2,
      strokeColor: EXCALIDRAW_STROKE_PRIMARY,
      backgroundColor: EXCALIDRAW_NODE_BG,
      fillStyle: 'solid',
      label: {
        text: label,
        fontSize: 18,
        fontFamily: STRUCTURE_FONT_FAMILY,
        strokeColor: EXCALIDRAW_STROKE_PRIMARY,
        textAlign: 'center',
        verticalAlign: 'middle',
      },
    });
  });

  const directedEdgePairSet = new Set(
    edges.map((edge) => `${edge.from}\0${edge.to}`)
  );

  edges.forEach((edge, index) => {
    const fromId = nodeIdByLabel.get(edge.from);
    const toId = nodeIdByLabel.get(edge.to);
    const fromCenter = positions.get(edge.from);
    const toCenter = positions.get(edge.to);

    if (!fromId || !toId || !fromCenter || !toCenter) {
      return;
    }

    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 1) {
      return;
    }

    const ux = dx / distance;
    const uy = dy / distance;
    const trim =
      distance > edgePadding * 2 ? edgePadding : distance * 0.25;

    // Quando existir par bidirecional (u->v e v->u), desloca levemente na perpendicular.
    const hasReverseEdge =
      directed && directedEdgePairSet.has(`${edge.to}\0${edge.from}`);
    const perpOffset = hasReverseEdge ? 9 : 0;
    const px = -uy * perpOffset;
    const py = ux * perpOffset;

    const startX = fromCenter.x + ux * trim + px;
    const startY = fromCenter.y + uy * trim + py;
    const endX = toCenter.x - ux * trim + px;
    const endY = toCenter.y - uy * trim + py;

    elements.push({
      id: createUniqueId(`graph-edge-${index}`),
      type: 'arrow',
      x: startX,
      y: startY,
      points: toLocalPoints([
        [0, 0],
        [endX - startX, endY - startY],
      ]),
      roughness: 0,
      roundness: { type: PROPORTIONAL_ROUNDNESS_TYPE },
      strokeWidth: 2,
      strokeColor: EXCALIDRAW_STROKE_PRIMARY,
      startArrowhead: null,
      endArrowhead: directed ? 'arrow' : null,
      start: { id: fromId },
      end: { id: toId },
    });
  });

  return elements;
}

// ============================================================================
// 4. PLANO CARTESIANO
// ============================================================================

export type CartesianQuadrantMode = 'four' | 'first';

export interface BuildCartesianPlaneOptions extends LousaViewportOrigin {
  quadrantMode?: CartesianQuadrantMode;
  axisRange?: number;
  showGrid?: boolean;
  showLabels?: boolean;
  locked?: boolean;
}

/**
 * Gera um plano cartesiano com eixos graduados, grade auxiliar opcional e
 * agrupamento único (com `locked: true` por padrão para desenhar por cima).
 */
export function buildCartesianPlaneSkeleton(
  options: BuildCartesianPlaneOptions
): ExcalidrawElementSkeleton[] {
  const quadrantMode: CartesianQuadrantMode = options.quadrantMode ?? 'four';
  const axisRange = clampInt(
    options.axisRange,
    CARTESIAN_MIN_RANGE,
    CARTESIAN_MAX_RANGE,
    5
  );
  const showGrid = options.showGrid ?? true;
  const showLabels = options.showLabels ?? true;
  const locked = options.locked ?? true;

  const unitPx = 48;
  const arrowOverhangPx = 32;
  const firstQuadTailPx = 22;

  const minVal = quadrantMode === 'four' ? -axisRange : 0;
  const maxVal = axisRange;

  const halfFirstSpan = (axisRange * unitPx) / 2;
  const mathOriginX =
    quadrantMode === 'four'
      ? options.originX
      : options.originX - halfFirstSpan;
  const mathOriginY =
    quadrantMode === 'four'
      ? options.originY
      : options.originY + halfFirstSpan;

  const xLeftPx =
    minVal === 0
      ? mathOriginX - firstQuadTailPx
      : mathOriginX + minVal * unitPx - arrowOverhangPx;
  const xRightPx = mathOriginX + maxVal * unitPx + arrowOverhangPx;

  const yBottomPx =
    minVal === 0
      ? mathOriginY + firstQuadTailPx
      : mathOriginY - minVal * unitPx + arrowOverhangPx;
  const yTopPx = mathOriginY - maxVal * unitPx - arrowOverhangPx;

  const planeGroupId = createUniqueId('cartesian-plane-group');
  const elements: ExcalidrawElementSkeleton[] = [];

  if (showGrid) {
    const gridTop = yTopPx + 14;
    const gridBottom = yBottomPx - (minVal === 0 ? 12 : 14);
    const gridLeft = xLeftPx + (minVal === 0 ? 12 : 14);
    const gridRight = xRightPx - 14;

    for (let k = minVal; k <= maxVal; k += 1) {
      if (k === 0) {
        continue;
      }

      const gx = mathOriginX + k * unitPx;
      elements.push({
        id: createUniqueId(`plane-vgrid-${k}`),
        type: 'line',
        x: gx,
        y: gridTop,
        points: toLocalPoints([
          [0, 0],
          [0, gridBottom - gridTop],
        ]),
        roughness: 0,
        roundness: null,
        strokeWidth: 1,
        strokeColor: EXCALIDRAW_GRID_STROKE,
        opacity: 55,
        locked,
        groupIds: [planeGroupId],
      });

      const gy = mathOriginY - k * unitPx;
      elements.push({
        id: createUniqueId(`plane-hgrid-${k}`),
        type: 'line',
        x: gridLeft,
        y: gy,
        points: toLocalPoints([
          [0, 0],
          [gridRight - gridLeft, 0],
        ]),
        roughness: 0,
        roundness: null,
        strokeWidth: 1,
        strokeColor: EXCALIDRAW_GRID_STROKE,
        opacity: 55,
        locked,
        groupIds: [planeGroupId],
      });
    }
  }

  // Eixo X
  elements.push({
    id: createUniqueId('plane-axis-x'),
    type: 'arrow',
    x: xLeftPx,
    y: mathOriginY,
    points: toLocalPoints([
      [0, 0],
      [xRightPx - xLeftPx, 0],
    ]),
    roughness: 0,
    roundness: null,
    strokeWidth: 2,
    strokeColor: EXCALIDRAW_STROKE_PRIMARY,
    startArrowhead: null,
    endArrowhead: 'arrow',
    locked,
    groupIds: [planeGroupId],
  });

  // Eixo Y
  elements.push({
    id: createUniqueId('plane-axis-y'),
    type: 'arrow',
    x: mathOriginX,
    y: yBottomPx,
    points: toLocalPoints([
      [0, 0],
      [0, yTopPx - yBottomPx],
    ]),
    roughness: 0,
    roundness: null,
    strokeWidth: 2,
    strokeColor: EXCALIDRAW_STROKE_PRIMARY,
    startArrowhead: null,
    endArrowhead: 'arrow',
    locked,
    groupIds: [planeGroupId],
  });

  // Ticks nos inteiros dos dois eixos
  for (let k = minVal; k <= maxVal; k += 1) {
    if (k === 0) {
      continue;
    }

    const tickX = mathOriginX + k * unitPx;
    elements.push({
      id: createUniqueId(`plane-xtick-${k}`),
      type: 'line',
      x: tickX,
      y: mathOriginY - 5,
      points: toLocalPoints([
        [0, 0],
        [0, 10],
      ]),
      roughness: 0,
      roundness: null,
      strokeWidth: 1.5,
      strokeColor: EXCALIDRAW_STROKE_PRIMARY,
      locked,
      groupIds: [planeGroupId],
    });

    const tickY = mathOriginY - k * unitPx;
    elements.push({
      id: createUniqueId(`plane-ytick-${k}`),
      type: 'line',
      x: mathOriginX - 5,
      y: tickY,
      points: toLocalPoints([
        [0, 0],
        [10, 0],
      ]),
      roughness: 0,
      roundness: null,
      strokeWidth: 1.5,
      strokeColor: EXCALIDRAW_STROKE_PRIMARY,
      locked,
      groupIds: [planeGroupId],
    });

    if (showLabels) {
      const labelText = String(k);
      const tickFontSize = 13;

      const xNumPos = estimateCenteredTextPos(
        tickX,
        mathOriginY + 18,
        labelText,
        tickFontSize
      );
      elements.push({
        id: createUniqueId(`plane-xlabel-${k}`),
        type: 'text',
        x: xNumPos.x,
        y: xNumPos.y,
        text: labelText,
        fontSize: tickFontSize,
        fontFamily: STRUCTURE_FONT_FAMILY,
        textAlign: 'center',
        verticalAlign: 'middle',
        strokeColor: EXCALIDRAW_STROKE_SUBTLE,
        locked,
        groupIds: [planeGroupId],
      });

      const yNumWidth = Math.max(10, labelText.length * tickFontSize * 0.62);
      elements.push({
        id: createUniqueId(`plane-ylabel-${k}`),
        type: 'text',
        x: mathOriginX - 12 - yNumWidth,
        y: tickY - (tickFontSize * 1.25) / 2,
        text: labelText,
        fontSize: tickFontSize,
        fontFamily: STRUCTURE_FONT_FAMILY,
        textAlign: 'right',
        verticalAlign: 'middle',
        strokeColor: EXCALIDRAW_STROKE_SUBTLE,
        locked,
        groupIds: [planeGroupId],
      });
    }
  }

  if (showLabels) {
    elements.push(
      {
        id: createUniqueId('plane-label-origin'),
        type: 'text',
        x: mathOriginX - 18,
        y: mathOriginY + 8,
        text: '0',
        fontSize: 13,
        fontFamily: STRUCTURE_FONT_FAMILY,
        textAlign: 'center',
        verticalAlign: 'middle',
        strokeColor: EXCALIDRAW_STROKE_SUBTLE,
        locked,
        groupIds: [planeGroupId],
      },
      {
        id: createUniqueId('plane-label-axis-x'),
        type: 'text',
        x: xRightPx - 6,
        y: mathOriginY + 10,
        text: 'x',
        fontSize: 16,
        fontFamily: STRUCTURE_FONT_FAMILY,
        textAlign: 'center',
        verticalAlign: 'middle',
        strokeColor: EXCALIDRAW_STROKE_PRIMARY,
        locked,
        groupIds: [planeGroupId],
      },
      {
        id: createUniqueId('plane-label-axis-y'),
        type: 'text',
        x: mathOriginX + 12,
        y: yTopPx - 4,
        text: 'y',
        fontSize: 16,
        fontFamily: STRUCTURE_FONT_FAMILY,
        textAlign: 'center',
        verticalAlign: 'middle',
        strokeColor: EXCALIDRAW_STROKE_PRIMARY,
        locked,
        groupIds: [planeGroupId],
      }
    );
  }

  return elements;
}
