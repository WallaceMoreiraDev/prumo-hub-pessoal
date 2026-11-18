// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  if (typeof HTMLCanvasElement !== 'undefined') {
    const mockContext2d = {
      font: '16px sans-serif',
      filter: 'none',
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      measureText: (text: string) => ({
        width: text.length * 10,
        actualBoundingBoxAscent: 12,
        actualBoundingBoxDescent: 4,
      }),
      fillRect: () => undefined,
      clearRect: () => undefined,
      strokeRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: () => undefined,
      fill: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      scale: () => undefined,
      translate: () => undefined,
      rotate: () => undefined,
      setTransform: () => undefined,
      fillText: () => undefined,
      strokeText: () => undefined,
    } as unknown as CanvasRenderingContext2D;

    HTMLCanvasElement.prototype.getContext = ((contextId: string) =>
      contextId === '2d'
        ? mockContext2d
        : null) as HTMLCanvasElement['getContext'];
  }

  if (typeof globalThis.FontFace === 'undefined') {
    class MockFontFace {
      family: string;
      source: string;
      status = 'loaded';
      descriptors: FontFaceDescriptors;

      constructor(
        family: string,
        source: string,
        descriptors: FontFaceDescriptors = {}
      ) {
        this.family = family;
        this.source = source;
        this.descriptors = descriptors;
      }

      async load(): Promise<this> {
        return this;
      }
    }

    (
      globalThis as unknown as { FontFace: typeof MockFontFace }
    ).FontFace = MockFontFace;
  }

  if (typeof document !== 'undefined' && !('fonts' in document)) {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        add: () => undefined,
        delete: () => true,
        clear: () => undefined,
        has: () => false,
        ready: Promise.resolve(),
      },
    });
  }
});

import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import {
  buildCartesianPlaneSkeleton,
  buildGraphSkeleton,
  buildMatrixSkeleton,
  buildTableSkeleton,
  parseGraphEdgeList,
} from '@/features/lousas/utils/lousaStructures';

describe('lousaStructures', () => {
  describe('buildMatrixSkeleton', () => {
    it('gera delimitadores agrupados para [ ], ( ) e | | e respeita dimensões e limites', () => {
      const brackets = buildMatrixSkeleton({
        originX: 100,
        originY: 200,
        rows: 2,
        cols: 3,
        delimiter: 'brackets',
        preset: 'blank',
      });
      const bracketLines = brackets.filter((el) => el.type === 'line');
      const blankCells = brackets.filter((el) => el.type === 'rectangle');
      expect(bracketLines).toHaveLength(2);
      expect(bracketLines[0]?.groupIds).toEqual(bracketLines[1]?.groupIds);
      expect(bracketLines[0]?.groupIds?.length).toBe(1);
      expect(blankCells).toHaveLength(6);
      expect(brackets.filter((el) => el.type === 'text')).toHaveLength(0);

      const parens = buildMatrixSkeleton({
        originX: 0,
        originY: 0,
        rows: 3,
        cols: 2,
        delimiter: 'parens',
        preset: 'zeros',
      });
      const parenLines = parens.filter((el) => el.type === 'line');
      expect(parenLines).toHaveLength(2);
      parenLines.forEach((line) => {
        expect('points' in line && line.points && line.points.length).toBeGreaterThan(
          4
        );
      });

      const bars = buildMatrixSkeleton({
        originX: 0,
        originY: 0,
        rows: 99,
        cols: 0,
        delimiter: 'bars',
        preset: 'blank',
      });
      // Clamped para max=8 linhas e min=1 coluna => 8 células + 2 barras
      expect(bars.filter((el) => el.type === 'line')).toHaveLength(2);
      expect(bars.filter((el) => el.type === 'rectangle')).toHaveLength(8);
    });

    it('gera textos centralizados nos presets zeros e identity', () => {
      const identity = buildMatrixSkeleton({
        originX: 0,
        originY: 0,
        rows: 3,
        cols: 3,
        preset: 'identity',
      });
      const identityTexts = identity.filter(
        (el): el is Extract<(typeof identity)[number], { type: 'text' }> =>
          el.type === 'text'
      );
      expect(identityTexts).toHaveLength(9);
      expect(identityTexts.map((t) => t.text)).toEqual([
        '1',
        '0',
        '0',
        '0',
        '1',
        '0',
        '0',
        '0',
        '1',
      ]);

      const zeros = buildMatrixSkeleton({
        originX: 0,
        originY: 0,
        rows: 2,
        cols: 4,
        preset: 'zeros',
      });
      const zeroTexts = zeros.filter(
        (el): el is Extract<(typeof zeros)[number], { type: 'text' }> =>
          el.type === 'text'
      );
      expect(zeroTexts).toHaveLength(8);
      expect(zeroTexts.every((t) => t.text === '0')).toBe(true);
    });
  });

  describe('buildTableSkeleton', () => {
    it('gera exatamente rows * cols células e destaca a primeira linha quando hasHeader=true', () => {
      const tableWithHeader = buildTableSkeleton({
        originX: 300,
        originY: 250,
        rows: 4,
        cols: 3,
        hasHeader: true,
      });

      expect(tableWithHeader).toHaveLength(12);

      const headerCells = tableWithHeader.slice(0, 3);
      const bodyCells = tableWithHeader.slice(3);

      headerCells.forEach((cell, index) => {
        expect(cell.type).toBe('rectangle');
        expect(cell.backgroundColor).toBe('#e9ecef');
        expect(cell.fillStyle).toBe('solid');
        if ('label' in cell) {
          expect(cell.label?.text).toBe(`Col ${index + 1}`);
        } else {
          throw new Error('Célula de cabeçalho deveria possuir label.');
        }
      });

      bodyCells.forEach((cell) => {
        expect(cell.backgroundColor).toBe('transparent');
        expect('label' in cell ? cell.label : undefined).toBeUndefined();
      });

      const tableNoHeader = buildTableSkeleton({
        originX: 0,
        originY: 0,
        rows: 2,
        cols: 5,
        hasHeader: false,
      });
      expect(tableNoHeader).toHaveLength(10);
      expect(
        tableNoHeader.every((cell) => cell.backgroundColor === 'transparent')
      ).toBe(true);

      const converted = convertToExcalidrawElements(tableWithHeader, {
        regenerateIds: true,
      });
      expect(converted.filter((el) => el.type === 'rectangle')).toHaveLength(12);
    });
  });

  describe('parseGraphEdgeList', () => {
    it('suporta hífen, seta ->, espaço por linha, vírgula, ponto e vírgula e vértice isolado', () => {
      const parsed = parseGraphEdgeList(
        '1-2, 2->3; 3 4\n5\n 2-1 , A - B ',
        { directed: false }
      );

      expect(parsed.ok).toBe(true);
      expect(parsed.error).toBeNull();
      expect(parsed.nodes).toEqual(['1', '2', '3', '4', '5', 'A', 'B']);
      // 2-1 deve ser deduplicada quando não direcionado
      expect(parsed.edges).toEqual([
        { from: '1', to: '2' },
        { from: '2', to: '3' },
        { from: '3', to: '4' },
        { from: 'A', to: 'B' },
      ]);

      const directedParsed = parseGraphEdgeList('1->2, 2->1, 1->2', {
        directed: true,
      });
      expect(directedParsed.ok).toBe(true);
      expect(directedParsed.edges).toEqual([
        { from: '1', to: '2' },
        { from: '2', to: '1' },
      ]);
    });

    it('rejeita entrada vazia, formato inválido, autolaço e excesso de vértices/arestas', () => {
      expect(parseGraphEdgeList('   ').ok).toBe(false);
      expect(parseGraphEdgeList('1-2-3').ok).toBe(false);
      expect(parseGraphEdgeList('1-1').ok).toBe(false);

      const seventeenNodes = Array.from({ length: 17 }, (_, i) => `v${i}`).join(
        ', '
      );
      const tooManyNodes = parseGraphEdgeList(seventeenNodes);
      expect(tooManyNodes.ok).toBe(false);
      expect(tooManyNodes.error).toContain('16');

      const edges41: string[] = [];
      for (let i = 0; i < 10; i += 1) {
        for (let j = i + 1; j < 10; j += 1) {
          if (edges41.length < 41) {
            edges41.push(`${i}-${j}`);
          }
        }
      }
      const tooManyEdges = parseGraphEdgeList(edges41.join('\n'));
      expect(tooManyEdges.ok).toBe(false);
      expect(tooManyEdges.error).toContain('40');
    });
  });

  describe('buildGraphSkeleton', () => {
    it('gera startBinding e endBinding válidos para vértices reais e nunca colide IDs em duas inserções consecutivas', () => {
      const firstSkeleton = buildGraphSkeleton({
        originX: 0,
        originY: 0,
        mode: 'edge-list',
        directed: true,
        layout: 'tree',
        edgeListText: '1->2, 1->3, 2->4, 5',
      });
      const secondSkeleton = buildGraphSkeleton({
        originX: 200,
        originY: 100,
        mode: 'preset',
        directed: false,
        nodeCount: 5,
        labelStyle: 'letters',
        layout: 'circle',
      });

      const firstConverted = convertToExcalidrawElements(firstSkeleton, {
        regenerateIds: true,
      });
      const secondConverted = convertToExcalidrawElements(secondSkeleton, {
        regenerateIds: true,
      });

      const firstNodes = firstConverted.filter((el) => el.type === 'ellipse');
      const firstNodeIds = new Set(firstNodes.map((node) => node.id));
      const firstArrows = firstConverted.filter((el) => el.type === 'arrow');

      expect(firstNodes).toHaveLength(5);
      expect(firstArrows).toHaveLength(3);
      for (const arrow of firstArrows) {
        if (arrow.type !== 'arrow') {
          continue;
        }
        expect(arrow.endArrowhead).toBe('arrow');
        expect(arrow.startBinding?.elementId).toBeTruthy();
        expect(arrow.endBinding?.elementId).toBeTruthy();
        expect(firstNodeIds.has(arrow.startBinding?.elementId ?? '')).toBe(true);
        expect(firstNodeIds.has(arrow.endBinding?.elementId ?? '')).toBe(true);
        expect(arrow.startBinding?.elementId).not.toBe(
          arrow.endBinding?.elementId
        );
      }

      const secondNodes = secondConverted.filter((el) => el.type === 'ellipse');
      const secondNodeIds = new Set(secondNodes.map((node) => node.id));
      const secondArrows = secondConverted.filter((el) => el.type === 'arrow');
      expect(secondNodes).toHaveLength(5);
      expect(secondArrows).toHaveLength(5);
      for (const arrow of secondArrows) {
        if (arrow.type !== 'arrow') {
          continue;
        }
        expect(arrow.endArrowhead).toBeNull();
        expect(secondNodeIds.has(arrow.startBinding?.elementId ?? '')).toBe(
          true
        );
        expect(secondNodeIds.has(arrow.endBinding?.elementId ?? '')).toBe(true);
      }

      // Garante ausência de colisão de IDs entre inserções consecutivas (tanto no skeleton quanto convertido)
      const firstAllIds = new Set(firstConverted.map((el) => el.id));
      const hasConvertedCollision = secondConverted.some((el) =>
        firstAllIds.has(el.id)
      );
      expect(hasConvertedCollision).toBe(false);

      const firstSkeletonIds = new Set(
        firstSkeleton.map((el) => el.id).filter(Boolean)
      );
      const hasSkeletonCollision = secondSkeleton.some(
        (el) => Boolean(el.id) && firstSkeletonIds.has(el.id)
      );
      expect(hasSkeletonCollision).toBe(false);
    });
  });

  describe('buildCartesianPlaneSkeleton', () => {
    it('suporta 4 quadrantes vs 1º quadrante, aplica locked=true em 100% dos elementos e inclui grade e rótulos', () => {
      const fourQuad = buildCartesianPlaneSkeleton({
        originX: 100,
        originY: 100,
        quadrantMode: 'four',
        axisRange: 4,
        showGrid: true,
        showLabels: true,
        locked: true,
      });

      expect(fourQuad.length).toBeGreaterThan(20);
      expect(fourQuad.every((el) => el.locked === true)).toBe(true);

      const fourGroupIds = new Set(
        fourQuad.flatMap((el) => el.groupIds ?? [])
      );
      expect(fourGroupIds.size).toBe(1);

      const fourLabels = fourQuad
        .filter(
          (el): el is Extract<(typeof fourQuad)[number], { type: 'text' }> =>
            el.type === 'text'
        )
        .map((t) => t.text);
      expect(fourLabels).toContain('-4');
      expect(fourLabels).toContain('4');
      expect(fourLabels).toContain('0');
      expect(fourLabels).toContain('x');
      expect(fourLabels).toContain('y');

      const fourGridLines = fourQuad.filter(
        (el) => el.type === 'line' && el.strokeColor === '#ced4da'
      );
      expect(fourGridLines.length).toBe(16); // 8 verticais + 8 horizontais (-4..-1 e 1..4)

      const firstQuadNoExtras = buildCartesianPlaneSkeleton({
        originX: 100,
        originY: 100,
        quadrantMode: 'first',
        axisRange: 5,
        showGrid: false,
        showLabels: false,
        locked: false,
      });

      expect(firstQuadNoExtras.every((el) => el.locked === false)).toBe(true);
      expect(
        firstQuadNoExtras.filter((el) => el.type === 'text')
      ).toHaveLength(0);
      expect(
        firstQuadNoExtras.filter(
          (el) => el.type === 'line' && el.strokeColor === '#ced4da'
        )
      ).toHaveLength(0);
      expect(
        firstQuadNoExtras.filter((el) => el.type === 'arrow')
      ).toHaveLength(2);
    });
  });
});
