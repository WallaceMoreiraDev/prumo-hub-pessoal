import { useEffect, useMemo, useState } from 'react';
import { CreateSimuladoPensamentoSchema } from '@shared/schemas/simulados.schema';
import type {
  SimuladoPensamentoDto,
  SimuladoQuestaoDto,
} from '@shared/types/simulados.types';
import {
  Loader2,
  MessageSquarePlus,
  MessageSquareText,
  Pencil,
  Send,
  Trash2,
} from 'lucide-react';
import { MarkdownMathRenderer } from '@/components/markdown/MarkdownMathRenderer';
import { SmartPasteTextarea } from '@/components/markdown/SmartPasteTextarea';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatTempoDecorrido } from '@/features/caderno-erros/utils/cadernoErros';
import { PensamentoEditDialog } from '@/features/simulados/components/PensamentoEditDialog';
import {
  useCreatePensamentoMutation,
  useDeletePensamentoMutation,
} from '@/features/simulados/hooks/useSimulados';
import {
  calculateSimuladoTimerSnapshot,
  comparePensamentosCronologico,
  resolveTimerConfig,
} from '@/features/simulados/utils/simulados';
import { getValidationFieldErrors } from '@/lib/errorMessages';
import { cn } from '@/lib/utils';

type TimelineFilter = 'CURRENT' | 'ALL';

export interface SimuladoPensamentosPanelProps {
  simuladoId: string;
  startedAt: string | null;
  duracaoConfiguradaSegundos: number;
  questoes: readonly SimuladoQuestaoDto[];
}

export function SimuladoPensamentosPanel({
  simuladoId,
  startedAt,
  duracaoConfiguradaSegundos,
  questoes,
}: SimuladoPensamentosPanelProps) {
  const createPensamentoMutation = useCreatePensamentoMutation();
  const deletePensamentoMutation = useDeletePensamentoMutation();

  const sortedQuestoes = useMemo(
    () =>
      [...questoes].sort((a, b) => {
        if (a.ordem !== b.ordem) {
          return a.ordem - b.ordem;
        }
        return a.createdAt.localeCompare(b.createdAt);
      }),
    [questoes]
  );

  const questaoMap = useMemo(() => {
    const map = new Map<string, SimuladoQuestaoDto>();
    for (const q of sortedQuestoes) {
      map.set(q.id, q);
    }
    return map;
  }, [sortedQuestoes]);

  const [activeQuestaoId, setActiveQuestaoId] = useState<string>(
    () => sortedQuestoes[0]?.id ?? ''
  );
  const [timelineFilter, setTimelineFilter] =
    useState<TimelineFilter>('CURRENT');
  const [descricaoInput, setDescricaoInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [editingPensamento, setEditingPensamento] =
    useState<SimuladoPensamentoDto | null>(null);
  const [deletingPensamento, setDeletingPensamento] =
    useState<SimuladoPensamentoDto | null>(null);

  useEffect(() => {
    if (sortedQuestoes.length === 0) {
      if (activeQuestaoId !== '') {
        setActiveQuestaoId('');
      }
      return;
    }

    const exists = sortedQuestoes.some((q) => q.id === activeQuestaoId);
    const firstQuestao = sortedQuestoes[0];
    if (!exists && firstQuestao) {
      setActiveQuestaoId(firstQuestao.id);
    }
  }, [sortedQuestoes, activeQuestaoId]);

  const visiblePensamentos = useMemo<SimuladoPensamentoDto[]>(() => {
    if (timelineFilter === 'CURRENT') {
      const targetQuestao = questaoMap.get(activeQuestaoId);
      if (!targetQuestao) {
        return [];
      }
      return [...targetQuestao.pensamentos].sort(comparePensamentosCronologico);
    }

    const all: SimuladoPensamentoDto[] = [];
    for (const q of sortedQuestoes) {
      all.push(...q.pensamentos);
    }
    return all.sort(comparePensamentosCronologico);
  }, [timelineFilter, questaoMap, activeQuestaoId, sortedQuestoes]);

  const totalPensamentosGeral = useMemo(
    () => sortedQuestoes.reduce((acc, q) => acc + q.pensamentos.length, 0),
    [sortedQuestoes]
  );

  async function submitPensamento(): Promise<void> {
    if (createPensamentoMutation.isPending || !activeQuestaoId) {
      return;
    }

    const timerConfig = resolveTimerConfig({
      simuladoId,
      startedAt,
      duracaoConfiguradaSegundos,
    });
    const timerSnapshot = calculateSimuladoTimerSnapshot({
      startedAt: timerConfig.startedAt,
      duracaoConfiguradaSegundos: timerConfig.duracaoConfiguradaSegundos,
      nowMs: Date.now(),
    });
    const clampedElapsed = Math.min(
      864_000,
      Math.max(0, timerSnapshot.elapsedSeconds)
    );

    const parsed = CreateSimuladoPensamentoSchema.safeParse({
      simuladoQuestaoId: activeQuestaoId,
      descricao: descricaoInput,
      tempoDecorridoSegundos: clampedElapsed,
    });

    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ??
          'Revise o conteúdo do pensamento antes de registrar.'
      );
      return;
    }

    setFormError(null);
    try {
      await createPensamentoMutation.mutateAsync({
        simuladoId,
        input: parsed.data,
      });
      setDescricaoInput('');
    } catch (error) {
      const serverFields = getValidationFieldErrors(error);
      if (serverFields.descricao) {
        setFormError(serverFields.descricao);
      } else if (serverFields.simuladoQuestaoId) {
        setFormError(serverFields.simuladoQuestaoId);
      }
    }
  }

  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitPensamento();
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deletingPensamento || deletePensamentoMutation.isPending) {
      return;
    }

    try {
      await deletePensamentoMutation.mutateAsync({
        simuladoId,
        pensamentoId: deletingPensamento.id,
      });
      setDeletingPensamento(null);
    } catch {
      // Erro tratado via toast no hook.
    }
  }

  return (
    <aside
      aria-label="Painel de registro de pensamentos da prova"
      className="flex min-h-[60vh] flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/85 backdrop-blur-md lg:min-h-0"
    >
      <div className="space-y-3 border-b border-border/60 p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <MessageSquarePlus
              className="h-4 w-4 shrink-0 text-primary"
              strokeWidth={1.75}
            />
            <h2 className="truncate text-sm font-semibold text-foreground">
              Pensamentos durante a prova
            </h2>
          </div>
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {totalPensamentosGeral}{' '}
            {totalPensamentosGeral === 1 ? 'registro' : 'registros'}
          </Badge>
        </div>

        <form onSubmit={handleFormSubmit} noValidate className="space-y-3">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="exec-questao-select" className="text-xs">
              Questão em foco
            </Label>
            <Select
              value={activeQuestaoId}
              disabled={
                sortedQuestoes.length === 0 ||
                createPensamentoMutation.isPending
              }
              onValueChange={setActiveQuestaoId}
            >
              <SelectTrigger
                id="exec-questao-select"
                aria-label="Selecionar questão em foco"
                className="w-full"
              >
                <SelectValue placeholder="Selecione uma questão..." />
              </SelectTrigger>
              <SelectContent className="max-w-[calc(100vw-2rem)]">
                {sortedQuestoes.map((questao) => (
                  <SelectItem
                    key={questao.id}
                    value={questao.id}
                    title={`${questao.numeroQuestao} — ${questao.tituloQuestao}`}
                    className="[&>span:last-child]:min-w-0 [&>span:last-child]:truncate"
                  >
                    {questao.numeroQuestao} — {questao.tituloQuestao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="exec-pensamento-textarea" className="text-xs">
                Novo pensamento
              </Label>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {descricaoInput.length}/4000
              </span>
            </div>

            <SmartPasteTextarea
              id="exec-pensamento-textarea"
              rows={3}
              maxLength={4000}
              disabled={
                createPensamentoMutation.isPending || !activeQuestaoId
              }
              value={descricaoInput}
              onChange={(event) => {
                setDescricaoInput(event.target.value);
                if (formError) {
                  setFormError(null);
                }
              }}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault();
                  void submitPensamento();
                }
              }}
              placeholder="Anote sua linha de raciocínio, hipótese, trava ou fórmula testada (Ctrl+Enter para enviar)..."
              className="resize-none bg-background/90"
            />

            {formError ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {formError}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={createPensamentoMutation.isPending || !activeQuestaoId}
            className="w-full gap-2"
          >
            {createPensamentoMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                <span>Registrando...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" strokeWidth={1.75} />
                <span>Registrar Pensamento</span>
              </>
            )}
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3.5 py-2 sm:px-4">
        <span className="text-xs font-medium text-muted-foreground">
          Linha do tempo cronológica
        </span>

        <div className="inline-flex rounded-xl bg-muted p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTimelineFilter('CURRENT')}
            className={cn(
              'rounded-lg px-2.5 py-1 font-medium transition-colors',
              timelineFilter === 'CURRENT'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Questão atual
          </button>
          <button
            type="button"
            onClick={() => setTimelineFilter('ALL')}
            className={cn(
              'rounded-lg px-2.5 py-1 font-medium transition-colors',
              timelineFilter === 'ALL'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Todas ({totalPensamentosGeral})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 sm:p-4">
        {visiblePensamentos.length === 0 ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-4 text-center">
            <MessageSquareText
              className="mb-2 h-5 w-5 text-muted-foreground"
              strokeWidth={1.75}
            />
            <p className="text-xs font-medium text-foreground">
              {timelineFilter === 'CURRENT'
                ? 'Nenhum pensamento nesta questão ainda'
                : 'Nenhum pensamento registrado neste simulado'}
            </p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              Cada anotação registra automaticamente o tempo decorrido na
              prova.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {visiblePensamentos.map((pensamento) => {
              const formattedStamp = formatTempoDecorrido(
                pensamento.tempoDecorridoSegundos
              );
              const parentQuestao = questaoMap.get(
                pensamento.simuladoQuestaoId
              );

              return (
                <li
                  key={pensamento.id}
                  className="space-y-2 rounded-xl border border-border bg-card/80 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground tabular-nums">
                        [{formattedStamp ?? '--:--'}]
                      </span>

                      {timelineFilter === 'ALL' && parentQuestao ? (
                        <Badge
                          variant="secondary"
                          className="max-w-[180px] gap-1 font-normal"
                          title={`${parentQuestao.numeroQuestao} — ${parentQuestao.tituloQuestao}`}
                        >
                          <span className="shrink-0 font-mono font-semibold">
                            {parentQuestao.numeroQuestao}
                          </span>
                          <span className="truncate">
                            {parentQuestao.tituloQuestao}
                          </span>
                        </Badge>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingPensamento(pensamento)}
                        aria-label="Editar pensamento"
                        title="Editar pensamento"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingPensamento(pensamento)}
                        aria-label="Excluir pensamento"
                        title="Excluir pensamento"
                        className="h-7 w-7 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </div>

                  <MarkdownMathRenderer content={pensamento.descricao} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <PensamentoEditDialog
        open={Boolean(editingPensamento)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setEditingPensamento(null);
          }
        }}
        simuladoId={simuladoId}
        pensamento={editingPensamento}
        questoes={sortedQuestoes}
      />

      <AlertDialog
        open={Boolean(deletingPensamento)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deletePensamentoMutation.isPending) {
            setDeletingPensamento(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pensamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este pensamento registrado durante
              o simulado?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePensamentoMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePensamentoMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePensamentoMutation.isPending ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Excluindo...</span>
                </>
              ) : (
                <span>Excluir pensamento</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
