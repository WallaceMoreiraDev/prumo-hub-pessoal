import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  AlertCircle,
  Grid3X3,
  Lock,
  Minus,
  MoveUpRight,
  Plus,
  Shapes,
  Share2,
  Table2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { LousaStructureInput } from '@/features/lousas/components/LousaExcalidrawCanvas';
import {
  CARTESIAN_MAX_RANGE,
  CARTESIAN_MIN_RANGE,
  GRAPH_COMPLETE_LAYOUT_MAX_NODES,
  GRAPH_MAX_PRESET_NODES,
  GRAPH_MIN_PRESET_NODES,
  MATRIX_MAX_DIMENSION,
  MATRIX_MIN_DIMENSION,
  TABLE_MAX_COLS,
  TABLE_MAX_ROWS,
  TABLE_MIN_COLS,
  TABLE_MIN_ROWS,
  buildCartesianPlaneSkeleton,
  buildGraphSkeleton,
  buildMatrixSkeleton,
  buildTableSkeleton,
  parseGraphEdgeList,
  type CartesianQuadrantMode,
  type GraphLabelStyle,
  type GraphLayout,
  type GraphMode,
  type MatrixDelimiter,
  type MatrixPreset,
} from '@/features/lousas/utils/lousaStructures';
import { cn } from '@/lib/utils';

type StructureTab = 'matrix' | 'table' | 'graph' | 'cartesian';

export interface LousaStructuresPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  disabled?: boolean;
  onInsertStructure: (
    structure: LousaStructureInput,
    feedbackLabel: string,
    options?: { selectInserted?: boolean }
  ) => void;
}

interface OptionItem<TValue extends string> {
  value: TValue;
  label: string;
}

const MATRIX_DELIMITER_OPTIONS: ReadonlyArray<OptionItem<MatrixDelimiter>> = [
  { value: 'brackets', label: '[ ] Colchetes' },
  { value: 'parens', label: '( ) Parênteses' },
  { value: 'bars', label: '| | Determinante' },
];

const MATRIX_PRESET_OPTIONS: ReadonlyArray<OptionItem<MatrixPreset>> = [
  { value: 'blank', label: 'Vazia' },
  { value: 'zeros', label: 'Zeros' },
  { value: 'identity', label: 'Identidade' },
];

const GRAPH_LABEL_OPTIONS: ReadonlyArray<OptionItem<GraphLabelStyle>> = [
  { value: 'one-based', label: '1..N' },
  { value: 'zero-based', label: '0..N-1' },
  { value: 'letters', label: 'A..L' },
];

const GRAPH_PRESET_LAYOUT_OPTIONS: ReadonlyArray<OptionItem<GraphLayout>> = [
  { value: 'circle', label: 'Círculo' },
  { value: 'tree', label: 'Árvore' },
  { value: 'path', label: 'Caminho' },
  { value: 'grid', label: 'Grade' },
  { value: 'complete', label: 'Completo' },
  { value: 'nodes-only', label: 'Só vértices' },
];

const GRAPH_EDGELIST_LAYOUT_OPTIONS: ReadonlyArray<
  OptionItem<'circle' | 'tree' | 'grid'>
> = [
  { value: 'circle', label: 'Círculo' },
  { value: 'tree', label: 'Árvore (BFS)' },
  { value: 'grid', label: 'Grade' },
];

const CARTESIAN_QUADRANT_OPTIONS: ReadonlyArray<
  OptionItem<CartesianQuadrantMode>
> = [
  { value: 'four', label: '4 quadrantes (-N..N)' },
  { value: 'first', label: '1º quadrante (0..N)' },
];

interface StepperControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (nextValue: number) => void;
}

function StepperControl({
  label,
  value,
  min,
  max,
  disabled = false,
  onChange,
}: StepperControlProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex h-9 items-center justify-between rounded-lg border border-border bg-background px-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Diminuir ${label}`}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Button>
        <span className="min-w-[2.5rem] text-center font-mono text-sm font-medium tabular-nums text-foreground">
          {value}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`Aumentar ${label}`}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Button>
      </div>
    </div>
  );
}

interface SegmentedOptionsProps<TValue extends string> {
  label: string;
  value: TValue;
  options: ReadonlyArray<OptionItem<TValue>>;
  columns?: 2 | 3;
  disabled?: boolean;
  onChange: (value: TValue) => void;
}

function SegmentedOptions<TValue extends string>({
  label,
  value,
  options,
  columns = 3,
  disabled = false,
  onChange,
}: SegmentedOptionsProps<TValue>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div
        className={cn(
          'grid gap-1.5',
          columns === 2 ? 'grid-cols-2' : 'grid-cols-3'
        )}
      >
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-lg border px-2 py-1.5 text-center text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                isSelected
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SwitchRowProps {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  showLockIcon?: boolean;
  onCheckedChange: (nextChecked: boolean) => void;
}

function SwitchRow({
  label,
  description,
  checked,
  disabled = false,
  showLockIcon = false,
  onCheckedChange,
}: SwitchRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          {showLockIcon ? (
            <Lock
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
          ) : null}
          <span>{label}</span>
        </div>
        {description ? (
          <p className="text-[11px] leading-snug text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      <span
        aria-hidden="true"
        className={cn(
          'inline-flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5 transition-colors',
          checked
            ? 'justify-end border-primary bg-primary'
            : 'justify-start border-border bg-muted'
        )}
      >
        <span className="h-3.5 w-3.5 rounded-full bg-background shadow-sm" />
      </span>
    </button>
  );
}

export function LousaStructuresPopover({
  open,
  onOpenChange,
  triggerRef,
  disabled = false,
  onInsertStructure,
}: LousaStructuresPopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<StructureTab>('matrix');

  // Matriz
  const [matrixRows, setMatrixRows] = useState(3);
  const [matrixCols, setMatrixCols] = useState(3);
  const [matrixDelimiter, setMatrixDelimiter] =
    useState<MatrixDelimiter>('brackets');
  const [matrixPreset, setMatrixPreset] = useState<MatrixPreset>('blank');

  // Tabela
  const [tableRows, setTableRows] = useState(4);
  const [tableCols, setTableCols] = useState(3);
  const [tableHasHeader, setTableHasHeader] = useState(true);

  // Grafo
  const [graphMode, setGraphMode] = useState<GraphMode>('preset');
  const [graphDirected, setGraphDirected] = useState(false);
  const [graphNodeCount, setGraphNodeCount] = useState(5);
  const [graphLabelStyle, setGraphLabelStyle] =
    useState<GraphLabelStyle>('one-based');
  const [graphPresetLayout, setGraphPresetLayout] =
    useState<GraphLayout>('circle');
  const [graphEdgeListText, setGraphEdgeListText] = useState(
    '1-2, 2-3, 1-4, 4-5'
  );
  const [graphEdgeListLayout, setGraphEdgeListLayout] = useState<
    'circle' | 'tree' | 'grid'
  >('circle');

  // Plano Cartesiano
  const [cartesianQuadrants, setCartesianQuadrants] =
    useState<CartesianQuadrantMode>('four');
  const [cartesianRange, setCartesianRange] = useState(5);
  const [cartesianShowGrid, setCartesianShowGrid] = useState(true);
  const [cartesianShowLabels, setCartesianShowLabels] = useState(true);
  const [cartesianLocked, setCartesianLocked] = useState(true);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (panelRef.current?.contains(target)) {
        return;
      }
      if (triggerRef?.current?.contains(target)) {
        return;
      }
      onOpenChange(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, onOpenChange, triggerRef]);

  const parsedEdgeList = useMemo(
    () =>
      parseGraphEdgeList(graphEdgeListText, {
        directed: graphDirected,
      }),
    [graphEdgeListText, graphDirected]
  );

  const effectivePresetMaxNodes =
    graphPresetLayout === 'complete'
      ? GRAPH_COMPLETE_LAYOUT_MAX_NODES
      : GRAPH_MAX_PRESET_NODES;
  const clampedPresetNodeCount = Math.min(
    graphNodeCount,
    effectivePresetMaxNodes
  );

  if (!open) {
    return null;
  }

  function handleInsertMatrix(): void {
    onInsertStructure(
      (origin) =>
        buildMatrixSkeleton({
          ...origin,
          rows: matrixRows,
          cols: matrixCols,
          delimiter: matrixDelimiter,
          preset: matrixPreset,
        }),
      `Matriz ${matrixRows}×${matrixCols} inserida na lousa.`
    );
  }

  function handleInsertTable(): void {
    onInsertStructure(
      (origin) =>
        buildTableSkeleton({
          ...origin,
          rows: tableRows,
          cols: tableCols,
          hasHeader: tableHasHeader,
        }),
      `Tabela ${tableRows}×${tableCols} inserida na lousa.`
    );
  }

  function handleInsertGraph(): void {
    if (graphMode === 'edge-list' && !parsedEdgeList.ok) {
      return;
    }

    const nodeSummary =
      graphMode === 'edge-list'
        ? parsedEdgeList.nodes.length
        : clampedPresetNodeCount;

    onInsertStructure(
      (origin) =>
        buildGraphSkeleton({
          ...origin,
          mode: graphMode,
          directed: graphDirected,
          nodeCount: clampedPresetNodeCount,
          labelStyle: graphLabelStyle,
          layout:
            graphMode === 'edge-list'
              ? graphEdgeListLayout
              : graphPresetLayout,
          edgeListText: graphEdgeListText,
        }),
      `Grafo com ${nodeSummary} vértice(s) inserido na lousa.`
    );
  }

  function handleInsertCartesian(): void {
    onInsertStructure(
      (origin) =>
        buildCartesianPlaneSkeleton({
          ...origin,
          quadrantMode: cartesianQuadrants,
          axisRange: cartesianRange,
          showGrid: cartesianShowGrid,
          showLabels: cartesianShowLabels,
          locked: cartesianLocked,
        }),
      cartesianQuadrants === 'four'
        ? `Plano cartesiano (-${cartesianRange}..${cartesianRange}) inserido na lousa.`
        : `Plano cartesiano (0..${cartesianRange}) inserido na lousa.`
    );
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Estruturas de estudo para inserir na lousa"
      className="absolute right-4 top-2 z-[75] max-h-[calc(100%-1rem)] w-[min(calc(100vw-2rem),26rem)] overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Shapes
            className="h-4 w-4 shrink-0 text-primary"
            strokeWidth={1.75}
          />
          <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
            Estruturas de Estudo
          </h3>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          aria-label="Fechar painel de estruturas"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(nextValue) => setActiveTab(nextValue as StructureTab)}
      >
        <TabsList className="grid h-auto w-full grid-cols-4 gap-1 p-1">
          <TabsTrigger
            value="matrix"
            className="gap-1 px-1.5 py-1.5 text-xs"
          >
            <Grid3X3 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">Matriz</span>
          </TabsTrigger>
          <TabsTrigger
            value="table"
            className="gap-1 px-1.5 py-1.5 text-xs"
          >
            <Table2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">Tabela</span>
          </TabsTrigger>
          <TabsTrigger
            value="graph"
            className="gap-1 px-1.5 py-1.5 text-xs"
          >
            <Share2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">Grafo</span>
          </TabsTrigger>
          <TabsTrigger
            value="cartesian"
            className="gap-1 px-1.5 py-1.5 text-xs"
          >
            <MoveUpRight
              className="h-3.5 w-3.5 shrink-0"
              strokeWidth={1.75}
            />
            <span className="truncate">Plano</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <StepperControl
              label="Linhas (1..8)"
              value={matrixRows}
              min={MATRIX_MIN_DIMENSION}
              max={MATRIX_MAX_DIMENSION}
              disabled={disabled}
              onChange={setMatrixRows}
            />
            <StepperControl
              label="Colunas (1..8)"
              value={matrixCols}
              min={MATRIX_MIN_DIMENSION}
              max={MATRIX_MAX_DIMENSION}
              disabled={disabled}
              onChange={setMatrixCols}
            />
          </div>

          <SegmentedOptions
            label="Delimitador"
            value={matrixDelimiter}
            options={MATRIX_DELIMITER_OPTIONS}
            disabled={disabled}
            onChange={setMatrixDelimiter}
          />

          <SegmentedOptions
            label="Preenchimento inicial"
            value={matrixPreset}
            options={MATRIX_PRESET_OPTIONS}
            disabled={disabled}
            onChange={setMatrixPreset}
          />

          <Button
            type="button"
            disabled={disabled}
            onClick={handleInsertMatrix}
            className="w-full"
          >
            Inserir na lousa
          </Button>
        </TabsContent>

        <TabsContent value="table" className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <StepperControl
              label="Linhas (2..10)"
              value={tableRows}
              min={TABLE_MIN_ROWS}
              max={TABLE_MAX_ROWS}
              disabled={disabled}
              onChange={setTableRows}
            />
            <StepperControl
              label="Colunas (2..8)"
              value={tableCols}
              min={TABLE_MIN_COLS}
              max={TABLE_MAX_COLS}
              disabled={disabled}
              onChange={setTableCols}
            />
          </div>

          <SwitchRow
            label="Cabeçalho destacado"
            description="Aplica fundo sutil na 1ª linha com rótulos editáveis (Col 1, Col 2...)."
            checked={tableHasHeader}
            disabled={disabled}
            onCheckedChange={setTableHasHeader}
          />

          <Button
            type="button"
            disabled={disabled}
            onClick={handleInsertTable}
            className="w-full"
          >
            Inserir na lousa
          </Button>
        </TabsContent>

        <TabsContent value="graph" className="space-y-3.5">
          <SegmentedOptions
            label="Modo de criação"
            value={graphMode}
            columns={2}
            options={[
              { value: 'preset', label: 'Preset' },
              { value: 'edge-list', label: 'Lista de arestas' },
            ]}
            disabled={disabled}
            onChange={setGraphMode}
          />

          <SwitchRow
            label="Grafo direcionado"
            description={
              graphDirected
                ? 'Arestas com seta apontando para o destino.'
                : 'Arestas simples sem seta nas pontas.'
            }
            checked={graphDirected}
            disabled={disabled}
            onCheckedChange={setGraphDirected}
          />

          {graphMode === 'preset' ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[9rem_1fr]">
                <StepperControl
                  label={`Vértices (2..${effectivePresetMaxNodes})`}
                  value={clampedPresetNodeCount}
                  min={GRAPH_MIN_PRESET_NODES}
                  max={effectivePresetMaxNodes}
                  disabled={disabled}
                  onChange={setGraphNodeCount}
                />
                <div className="min-w-0">
                  <SegmentedOptions
                    label="Rótulos"
                    value={graphLabelStyle}
                    options={GRAPH_LABEL_OPTIONS}
                    disabled={disabled}
                    onChange={setGraphLabelStyle}
                  />
                </div>
              </div>

              <SegmentedOptions
                label="Layout"
                value={graphPresetLayout}
                options={GRAPH_PRESET_LAYOUT_OPTIONS}
                disabled={disabled}
                onChange={(nextLayout) => {
                  setGraphPresetLayout(nextLayout);
                  if (
                    nextLayout === 'complete' &&
                    graphNodeCount > GRAPH_COMPLETE_LAYOUT_MAX_NODES
                  ) {
                    setGraphNodeCount(GRAPH_COMPLETE_LAYOUT_MAX_NODES);
                  }
                }}
              />
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label
                    htmlFor="lousa-graph-edge-list"
                    className="text-xs text-muted-foreground"
                  >
                    Arestas e vértices
                  </Label>
                  {parsedEdgeList.ok ? (
                    <span className="tabular-nums text-[11px] font-medium text-muted-foreground">
                      {parsedEdgeList.nodes.length} vértice(s) •{' '}
                      {parsedEdgeList.edges.length} aresta(s)
                    </span>
                  ) : null}
                </div>

                <textarea
                  id="lousa-graph-edge-list"
                  rows={3}
                  disabled={disabled}
                  value={graphEdgeListText}
                  onChange={(event) => setGraphEdgeListText(event.target.value)}
                  placeholder="1-2, 2-3, 1-4 (ou uma aresta por linha: 0 1)"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />

                {!parsedEdgeList.ok && parsedEdgeList.error ? (
                  <p
                    role="alert"
                    className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400"
                  >
                    <AlertCircle
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      strokeWidth={1.75}
                    />
                    <span>{parsedEdgeList.error}</span>
                  </p>
                ) : (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Aceita <code className="font-mono">1-2</code>,{' '}
                    <code className="font-mono">1-&gt;2</code>,{' '}
                    <code className="font-mono">0 1</code> por linha e vértice
                    isolado.
                  </p>
                )}
              </div>

              <SegmentedOptions
                label="Layout"
                value={graphEdgeListLayout}
                options={GRAPH_EDGELIST_LAYOUT_OPTIONS}
                disabled={disabled}
                onChange={setGraphEdgeListLayout}
              />
            </>
          )}

          <Button
            type="button"
            disabled={
              disabled || (graphMode === 'edge-list' && !parsedEdgeList.ok)
            }
            onClick={handleInsertGraph}
            className="w-full"
          >
            Inserir na lousa
          </Button>
        </TabsContent>

        <TabsContent value="cartesian" className="space-y-3.5">
          <SegmentedOptions
            label="Quadrantes"
            value={cartesianQuadrants}
            columns={2}
            options={CARTESIAN_QUADRANT_OPTIONS}
            disabled={disabled}
            onChange={setCartesianQuadrants}
          />

          <StepperControl
            label="Alcance dos eixos (3..10)"
            value={cartesianRange}
            min={CARTESIAN_MIN_RANGE}
            max={CARTESIAN_MAX_RANGE}
            disabled={disabled}
            onChange={setCartesianRange}
          />

          <div className="space-y-2">
            <SwitchRow
              label="Grade auxiliar"
              description="Linhas discretas por unidade para traçar gráficos com precisão."
              checked={cartesianShowGrid}
              disabled={disabled}
              onCheckedChange={setCartesianShowGrid}
            />
            <SwitchRow
              label="Rótulos nos eixos"
              description="Exibe ticks numéricos e identificadores x, y e 0."
              checked={cartesianShowLabels}
              disabled={disabled}
              onCheckedChange={setCartesianShowLabels}
            />
            <SwitchRow
              label="Travar plano para desenhar por cima (recomendado)"
              description="Impede arrastar os eixos acidentalmente ao escrever com a caneta."
              checked={cartesianLocked}
              disabled={disabled}
              showLockIcon
              onCheckedChange={setCartesianLocked}
            />
          </div>

          <Button
            type="button"
            disabled={disabled}
            onClick={handleInsertCartesian}
            className="w-full"
          >
            Inserir na lousa
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
