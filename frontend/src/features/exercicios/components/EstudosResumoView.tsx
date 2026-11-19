import { useMemo, useState } from 'react';
import type { EstudosResumoQuery } from '@shared/schemas/exercicios.schema';
import type { EstudoResumoItemDto } from '@shared/types/exercicios.types';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Code2,
  Edit,
  HelpCircle,
  Lightbulb,
  Loader2,
  PenTool,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { exerciciosApi } from '@/features/exercicios/api/exerciciosApi';
import { ListUpdatingTopBar } from '@/components/layout/ListFilterFeedback';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useDeleteExercicioMutation,
  useEstudosResumoQuery,
  useExercicioDetalheQuery,
} from '@/features/exercicios/hooks/useExercicios';
import { EstudoExportIaDialog } from '@/features/exercicios/components/EstudoExportIaDialog';
import { ExercicioExecucaoModal } from '@/features/exercicios/components/ExercicioExecucaoModal';
import { LousaCanvasModal } from '@/features/lousas/components/LousaCanvasModal';
import { cn } from '@/lib/utils';

export type PeriodoPreset =
  | 'hoje'
  | 'ontem'
  | 'esta_semana'
  | 'semana_passada'
  | 'custom';

function getLocalDateString(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDurationHuman(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0 min';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainderSeconds = seconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}min`;
  }
  return `${remainderSeconds}s`;
}

function formatItemTime(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatItemDateShort(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString([], {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export interface EstudosResumoViewProps {
  className?: string;
  defaultPeriodoPreset?: PeriodoPreset;
  onOpenNovoExercicioFromParent?: () => void;
}

export function EstudosResumoView({
  className,
  defaultPeriodoPreset = 'hoje',
}: EstudosResumoViewProps) {
  const [preset, setPreset] = useState<PeriodoPreset>(defaultPeriodoPreset);

  // Intervalo customizado
  const [customInicio, setCustomInicio] = useState<string>(() =>
    new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  );
  const [customFim, setCustomFim] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );

  // Modais
  const [isNovoExercicioOpen, setIsNovoExercicioOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EstudoResumoItemDto | null>(
    null
  );
  const [editingExercicioId, setEditingExercicioId] = useState<string | null>(
    null
  );
  const [deletingItem, setDeletingItem] = useState<{
    id: string;
    titulo: string;
  } | null>(null);
  const [viewingLousa, setViewingLousa] = useState<{
    id: string;
    title: string;
  } | null>(null);

  function handleStartEdit(item: EstudoResumoItemDto): void {
    setEditingItem(item);
    setEditingExercicioId(item.id);
  }

  async function handleOpenLousa(exercicioId: string, titulo: string): Promise<void> {
    try {
      const detalhe = await exerciciosApi.getById(exercicioId);
      if (detalhe.lousa?.id) {
        setViewingLousa({ id: detalhe.lousa.id, title: `Lousa: ${titulo}` });
      } else {
        toast.info('Lousa não encontrada para este exercício.');
      }
    } catch {
      toast.error('Erro ao carregar lousa do exercício.');
    }
  }

  // Montagem da query com base no preset
  const query: EstudosResumoQuery = useMemo(() => {
    switch (preset) {
      case 'hoje':
        return {
          periodo: 'dia',
          data: getLocalDateString(0),
        };
      case 'ontem':
        return {
          periodo: 'dia',
          data: getLocalDateString(-1),
        };
      case 'esta_semana':
        return {
          periodo: 'semana',
          data: getLocalDateString(0),
        };
      case 'semana_passada':
        return {
          periodo: 'semana',
          data: getLocalDateString(-7),
        };
      case 'custom':
        return {
          periodo: 'custom',
          dataInicio: new Date(`${customInicio}T00:00:00.000Z`).toISOString(),
          dataFim: new Date(`${customFim}T23:59:59.999Z`).toISOString(),
        };
      default:
        return {
          periodo: 'dia',
          data: getLocalDateString(0),
        };
    }
  }, [preset, customInicio, customFim]);

  const {
    data: resumo,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useEstudosResumoQuery(query);
  const isUpdating = isFetching && !isLoading;
  const deleteMutation = useDeleteExercicioMutation();

  // Query do exercício para edição quando solicitado
  const editingQuery = useExercicioDetalheQuery(
    editingExercicioId ?? '',
    Boolean(editingExercicioId)
  );

  async function handleConfirmDelete(): Promise<void> {
    if (!deletingItem) return;
    try {
      await deleteMutation.mutateAsync(deletingItem.id);
      setDeletingItem(null);
    } catch {
      // Toast já tratado na mutation
    }
  }

  const PRESETS: ReadonlyArray<{ id: PeriodoPreset; label: string }> = [
    { id: 'hoje', label: 'Hoje' },
    { id: 'ontem', label: 'Ontem' },
    { id: 'esta_semana', label: 'Esta Semana' },
    { id: 'semana_passada', label: 'Semana Passada' },
    { id: 'custom', label: 'Personalizado' },
  ];

  return (
    <div
      className={cn('relative space-y-6', className)}
      data-testid="estudos-resumo-view"
    >
      {/* Barra de Seleção de Período e Ações Principais */}
      <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <ListUpdatingTopBar isUpdating={isFetching || isUpdating} />
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              variant={preset === p.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPreset(p.id)}
              disabled={isFetching}
              className="h-8 rounded-lg px-3 text-xs font-medium"
            >
              {p.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExportDialogOpen(true)}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
            <span>Exportar para IA</span>
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => setIsNovoExercicioOpen(true)}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            <span>Novo Exercício / Estudo</span>
          </Button>
        </div>
      </div>

      {/* Inputs para Período Customizado */}
      {preset === 'custom' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-muted/20 p-3 text-xs">
          <div className="flex items-center gap-2">
            <Label htmlFor="custom-inicio" className="text-xs text-muted-foreground">
              De:
            </Label>
            <Input
              id="custom-inicio"
              type="date"
              value={customInicio}
              onChange={(e) => setCustomInicio(e.target.value)}
              className="h-8 w-36 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="custom-fim" className="text-xs text-muted-foreground">
              Até:
            </Label>
            <Input
              id="custom-fim"
              type="date"
              value={customFim}
              onChange={(e) => setCustomFim(e.target.value)}
              className="h-8 w-36 text-xs"
            />
          </div>
        </div>
      ) : null}

      {/* Cards de Métricas Principais */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm font-semibold">Erro ao carregar resumo de estudos</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            'grid grid-cols-1 gap-3 sm:grid-cols-3 transition-opacity duration-200',
            isFetching ? 'pointer-events-none opacity-60' : 'opacity-100'
          )}
        >
          {/* Tempo Total de Foco */}
          <Card className="rounded-2xl border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tempo Total de Foco
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <Clock className="h-4 w-4" strokeWidth={1.75} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-bold tracking-tight text-foreground">
                {formatDurationHuman(resumo?.tempoTotalSegundos ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Tempo dedicado a exercícios práticos no período
              </p>
            </CardContent>
          </Card>

          {/* Exercícios Resolvidos */}
          <Card className="rounded-2xl border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Exercícios Resolvidos
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                <Code2 className="h-4 w-4" strokeWidth={1.75} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-bold tracking-tight text-foreground">
                {resumo?.totalExercicios ?? 0}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                  {resumo?.totalSolo ?? 0} Solo
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-400">
                  <HelpCircle className="h-3 w-3" strokeWidth={2} />
                  {resumo?.totalHelp ?? 0} Help
                </span>
                {resumo?.totalSemDesfecho ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                    {resumo.totalSemDesfecho} Livre
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Reflexões & Conexões */}
          <Card className="rounded-2xl border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Reflexões & Conexões
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                <Lightbulb className="h-4 w-4" strokeWidth={1.75} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-bold tracking-tight text-foreground">
                {resumo?.totalReflexoes ?? 0}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Reflexões conceituais e sínteses registradas
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Painel de Temas Abordados */}
      {resumo?.temasAbordados && resumo.temasAbordados.length > 0 ? (
        <div
          className={cn(
            'space-y-3 rounded-2xl border border-border bg-card p-4 transition-opacity duration-200',
            isFetching ? 'pointer-events-none opacity-60' : 'opacity-100'
          )}
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" strokeWidth={1.75} />
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                Foco por Tema ({resumo.temasAbordados.length})
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Ordenado por tempo dedicado
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {resumo.temasAbordados.map((tema) => {
              const totalSeg = resumo.tempoTotalSegundos || 1;
              const percent = Math.min(
                100,
                Math.round((tema.tempoTotalSegundos / totalSeg) * 100)
              );

              return (
                <div
                  key={tema.temaId}
                  className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {tema.nomeTema}
                    </span>
                    <span className="font-mono text-xs font-bold text-primary">
                      {formatDurationHuman(tema.tempoTotalSegundos)}
                    </span>
                  </div>

                  {/* Barra visual de proporção de tempo */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
                    <span>
                      {tema.totalExercicios} exercício
                      {tema.totalExercicios === 1 ? '' : 's'}
                    </span>
                    <span>
                      {tema.totalReflexoes}{' '}
                      {tema.totalReflexoes === 1 ? 'reflexão' : 'reflexões'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Linha do Tempo de Atividades no Período */}
      <div
        className={cn(
          'space-y-3 transition-opacity duration-200',
          isFetching ? 'pointer-events-none opacity-60' : 'opacity-100'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" strokeWidth={1.75} />
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              Linha do Tempo de Atividades
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {resumo?.itens.length ?? 0} registro
            {(resumo?.itens.length ?? 0) === 1 ? '' : 's'}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : !resumo?.itens || resumo.itens.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Code2 className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Nenhum estudo registrado neste período
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                Inicie uma sessão de exercício avulso para cronometrar sua
                resolução, anotar raciocínios e atualizar o radar dos temas.
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setIsNovoExercicioOpen(true)}
              className="mt-1 gap-1.5 font-semibold"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              <span>Registrar primeiro exercício</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {resumo.itens.map((item) => {
              const isHelp = item.desfecho === 'HELP';
              const isSolo = item.desfecho === 'SOLO';
              const isExercicio = item.tipo === 'EXERCICIO';

              return (
                <div
                  key={`${item.tipo}-${item.id}`}
                  className={cn(
                    'flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors sm:flex-row sm:items-center',
                    isHelp && 'border-l-2 border-l-amber-500/80'
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs',
                        isExercicio
                          ? 'border-primary/20 bg-primary/10 text-primary'
                          : 'border-border bg-muted text-muted-foreground'
                      )}
                    >
                      {isExercicio ? (
                        <Code2 className="h-4 w-4" strokeWidth={1.75} />
                      ) : (
                        <Lightbulb className="h-4 w-4" strokeWidth={1.75} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {item.titulo}
                        </span>

                        {isExercicio && item.duracaoSegundos ? (
                          <span className="font-mono text-xs font-semibold text-muted-foreground">
                            • {formatDurationHuman(item.duracaoSegundos)}
                          </span>
                        ) : null}

                        {isSolo ? (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400"
                          >
                            Sozinho
                          </Badge>
                        ) : isHelp ? (
                          <Badge
                            variant="secondary"
                            className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400"
                          >
                            Com Ajuda
                          </Badge>
                        ) : null}

                        {item.hasLousa ? (
                          <Badge
                            variant="outline"
                            className="cursor-pointer gap-1 border-primary/30 text-primary hover:bg-primary/5"
                            onClick={() => {
                              if (isExercicio) {
                                void handleOpenLousa(item.id, item.titulo);
                              }
                            }}
                          >
                            <PenTool className="h-3 w-3" />
                            <span>Lousa</span>
                          </Badge>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {preset === 'hoje' || preset === 'ontem'
                            ? formatItemTime(item.createdAt)
                            : formatItemDateShort(item.createdAt)}
                        </span>

                        {item.temas.map((tema) => (
                          <span
                            key={tema.id}
                            className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-foreground"
                          >
                            {tema.nome}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Ações para exercícios */}
                  {isExercicio ? (
                    <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleStartEdit(item)}
                        title="Editar exercício"
                      >
                        <Edit className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400"
                        onClick={() =>
                          setDeletingItem({ id: item.id, titulo: item.titulo })
                        }
                        title="Excluir exercício"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Criação / Resolução de Exercício */}
      <ExercicioExecucaoModal
        open={isNovoExercicioOpen}
        onOpenChange={setIsNovoExercicioOpen}
      />

      {/* Modal de Edição de Exercício */}
      {editingExercicioId ? (
        <ExercicioExecucaoModal
          open={Boolean(editingExercicioId)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingExercicioId(null);
              setEditingItem(null);
            }
          }}
          editingExercicio={
            editingQuery.data ??
            (editingItem
              ? {
                  id: editingItem.id,
                  titulo: editingItem.titulo,
                  duracaoSegundos: editingItem.duracaoSegundos ?? 0,
                  desfecho: editingItem.desfecho ?? null,
                  temas: editingItem.temas,
                  lousa: null,
                  enunciado: null,
                  linkExterno: null,
                  observacao: null,
                  createdAt: editingItem.createdAt,
                  updatedAt: editingItem.createdAt,
                }
              : null)
          }
        />
      ) : null}

      {/* Diálogo de Exportação para IA */}
      <EstudoExportIaDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        query={query}
      />

      {/* Visualizador de Lousa do Estudo */}
      {viewingLousa ? (
        <LousaCanvasModal
          open={Boolean(viewingLousa)}
          onOpenChange={(open) => {
            if (!open) setViewingLousa(null);
          }}
          lousaId={viewingLousa.id}
          title={viewingLousa.title}
          onSaved={() => {
            setViewingLousa(null);
          }}
        />
      ) : null}

      {/* Confirmação de Exclusão */}
      <AlertDialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => {
          if (!open) setDeletingItem(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir exercício de estudo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o registro de{' '}
              <strong>"{deletingItem?.titulo}"</strong> e sua eventual lousa de
              rascunho associada. Esta operação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <span>Excluir Exercício</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
