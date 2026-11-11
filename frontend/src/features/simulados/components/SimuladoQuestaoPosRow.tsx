import { useEffect, useMemo, useRef, useState } from 'react';
import { ClassificarQuestaoSimuladoSchema } from '@shared/schemas/simulados.schema';
import type { QuestaoResultado } from '@shared/types/enums.types';
import type {
  SimuladoPensamentoDto,
  SimuladoQuestaoDto,
} from '@shared/types/simulados.types';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  HelpCircle,
  Loader2,
  MessageSquareText,
  Pencil,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { formatTempoDecorrido } from '@/features/caderno-erros/utils/cadernoErros';
import { PensamentoEditDialog } from '@/features/simulados/components/PensamentoEditDialog';
import {
  useClassificarQuestaoMutation,
  useDeletePensamentoMutation,
} from '@/features/simulados/hooks/useSimulados';
import { comparePensamentosCronologico } from '@/features/simulados/utils/simulados';
import { TemaSelector } from '@/features/temas-revisao/components/TemaSelector';
import { getValidationFieldErrors } from '@/lib/errorMessages';
import { cn } from '@/lib/utils';

export interface SimuladoQuestaoPosRowProps {
  simuladoId: string;
  questao: SimuladoQuestaoDto;
  questoesList: readonly SimuladoQuestaoDto[];
  isExpanded: boolean;
  onToggleExpand: (questaoId: string) => void;
  onEnsureExpanded: (questaoId: string) => void;
}

function areStringArraysEqual(
  a: readonly string[],
  b: readonly string[]
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const setA = new Set(a);
  if (setA.size !== new Set(b).size) {
    return false;
  }
  return b.every((item) => setA.has(item));
}

export function SimuladoQuestaoPosRow({
  simuladoId,
  questao,
  questoesList,
  isExpanded,
  onToggleExpand,
  onEnsureExpanded,
}: SimuladoQuestaoPosRowProps) {
  const classificarMutation = useClassificarQuestaoMutation();
  const deletePensamentoMutation = useDeletePensamentoMutation();

  const initialTemaIds = useMemo(
    () => questao.temas.map((tema) => tema.id),
    [questao.temas]
  );

  const [selectedTemaIds, setSelectedTemaIds] =
    useState<string[]>(initialTemaIds);
  const [draftObservacao, setDraftObservacao] = useState<string>(
    questao.observacaoPosRevisao ?? ''
  );
  const [observacaoError, setObservacaoError] = useState<string | null>(null);
  const [pendingResultado, setPendingResultado] =
    useState<QuestaoResultado | null>(null);

  const [confirmAcerteiOpen, setConfirmAcerteiOpen] = useState(false);
  const [editingPensamento, setEditingPensamento] =
    useState<SimuladoPensamentoDto | null>(null);
  const [deletingPensamento, setDeletingPensamento] =
    useState<SimuladoPensamentoDto | null>(null);

  const serverSnapshotRef = useRef({
    questaoId: questao.id,
    resultado: questao.resultado,
    temaIds: initialTemaIds,
    observacao: questao.observacaoPosRevisao ?? '',
  });

  useEffect(() => {
    const idChanged = serverSnapshotRef.current.questaoId !== questao.id;
    const serverChanged =
      idChanged ||
      serverSnapshotRef.current.resultado !== questao.resultado ||
      !areStringArraysEqual(serverSnapshotRef.current.temaIds, initialTemaIds) ||
      serverSnapshotRef.current.observacao !==
        (questao.observacaoPosRevisao ?? '');

    if (!serverChanged) {
      return;
    }

    const wasDirtyBeforeSync =
      !areStringArraysEqual(selectedTemaIds, serverSnapshotRef.current.temaIds) ||
      draftObservacao !== serverSnapshotRef.current.observacao;

    serverSnapshotRef.current = {
      questaoId: questao.id,
      resultado: questao.resultado,
      temaIds: initialTemaIds,
      observacao: questao.observacaoPosRevisao ?? '',
    };

    if (idChanged || !wasDirtyBeforeSync) {
      setSelectedTemaIds(initialTemaIds);
      setDraftObservacao(questao.observacaoPosRevisao ?? '');
      setObservacaoError(null);
    }
  }, [
    questao.id,
    questao.resultado,
    questao.observacaoPosRevisao,
    initialTemaIds,
    selectedTemaIds,
    draftObservacao,
  ]);

  const sortedPensamentos = useMemo(
    () => [...questao.pensamentos].sort(comparePensamentosCronologico),
    [questao.pensamentos]
  );

  const hasDirtyTemas = !areStringArraysEqual(
    selectedTemaIds,
    serverSnapshotRef.current.temaIds
  );
  const hasDirtyObservacao =
    draftObservacao.trim() !== serverSnapshotRef.current.observacao.trim();
  const hasDirtyClassification = hasDirtyTemas || hasDirtyObservacao;

  const isParcialOuErrei =
    questao.resultado === 'PARCIAL' || questao.resultado === 'ERREI';

  async function executeClassificacao(
    targetResultado: QuestaoResultado,
    nextTemaIds: string[],
    nextObservacaoRaw: string | null,
    options?: { expandOnSuccess?: boolean }
  ): Promise<void> {
    if (classificarMutation.isPending) {
      return;
    }

    const normalizedObs =
      targetResultado === 'ACERTEI'
        ? null
        : nextObservacaoRaw && nextObservacaoRaw.trim().length > 0
          ? nextObservacaoRaw.trim()
          : null;

    const parsed = ClassificarQuestaoSimuladoSchema.safeParse({
      resultado: targetResultado,
      temaIds: nextTemaIds,
      observacaoPosRevisao: normalizedObs,
    });

    if (!parsed.success) {
      setObservacaoError(
        parsed.error.issues[0]?.message ??
          'Dados inválidos para classificar a questão.'
      );
      return;
    }

    setObservacaoError(null);
    setPendingResultado(targetResultado);
    try {
      const updated = await classificarMutation.mutateAsync({
        simuladoId,
        questaoId: questao.id,
        input: parsed.data,
      });

      const updatedTemaIds = updated.temas.map((tema) => tema.id);
      const updatedObs = updated.observacaoPosRevisao ?? '';

      serverSnapshotRef.current = {
        questaoId: updated.id,
        resultado: updated.resultado,
        temaIds: updatedTemaIds,
        observacao: updatedObs,
      };
      setSelectedTemaIds(updatedTemaIds);
      setDraftObservacao(updatedObs);

      if (options?.expandOnSuccess) {
        onEnsureExpanded(questao.id);
      }
    } catch (error) {
      const fieldErrors = getValidationFieldErrors(error);
      if (fieldErrors.observacaoPosRevisao) {
        setObservacaoError(fieldErrors.observacaoPosRevisao);
      }
    } finally {
      setPendingResultado(null);
    }
  }

  function handleQuickResultadoClick(targetResultado: QuestaoResultado): void {
    if (classificarMutation.isPending) {
      return;
    }

    if (targetResultado === 'PARCIAL' || targetResultado === 'ERREI') {
      if (questao.resultado === targetResultado && !hasDirtyClassification) {
        onEnsureExpanded(questao.id);
        return;
      }

      void executeClassificacao(
        targetResultado,
        selectedTemaIds,
        draftObservacao,
        { expandOnSuccess: true }
      );
      return;
    }

    const hasExistingErrorOrNote =
      questao.resultado === 'PARCIAL' ||
      questao.resultado === 'ERREI' ||
      draftObservacao.trim().length > 0 ||
      (questao.observacaoPosRevisao !== null &&
        questao.observacaoPosRevisao.trim().length > 0);

    if (hasExistingErrorOrNote) {
      setConfirmAcerteiOpen(true);
      return;
    }

    void executeClassificacao('ACERTEI', selectedTemaIds, null);
  }

  async function handleConfirmAcertei(): Promise<void> {
    setConfirmAcerteiOpen(false);
    await executeClassificacao('ACERTEI', selectedTemaIds, null);
  }

  async function handleConfirmDeletePensamento(): Promise<void> {
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

  const visibleTemas = questao.temas.slice(0, 3);
  const extraTemasCount = Math.max(
    0,
    questao.temas.length - visibleTemas.length
  );

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card transition-colors',
        'hover:border-slate-300 dark:hover:border-slate-700',
        questao.resultado === 'PARCIAL' && 'border-l-2 border-l-amber-500/80'
      )}
    >
      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <button
          type="button"
          onClick={() => onToggleExpand(questao.id)}
          aria-expanded={isExpanded}
          className="group flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
        >
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-foreground">
            <ChevronRight
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                isExpanded && 'rotate-90 text-foreground'
              )}
              strokeWidth={1.75}
            />
          </span>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                {questao.numeroQuestao}
              </span>
              <h3 className="min-w-0 break-words text-sm font-semibold tracking-tight text-foreground sm:text-base">
                {questao.tituloQuestao}
              </h3>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {visibleTemas.map((tema) => (
                <Badge
                  key={tema.id}
                  variant="secondary"
                  className="max-w-[180px] font-normal"
                  title={tema.nome}
                >
                  <span className="truncate">{tema.nome}</span>
                </Badge>
              ))}

              {extraTemasCount > 0 ? (
                <Badge variant="secondary" className="font-normal">
                  +{extraTemasCount}
                </Badge>
              ) : null}

              {questao.temas.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Sem temas vinculados
                </span>
              ) : null}

              {questao.pensamentos.length > 0 ? (
                <Badge
                  variant="outline"
                  className="gap-1 font-normal text-muted-foreground tabular-nums"
                >
                  <MessageSquareText className="h-3 w-3" strokeWidth={1.75} />
                  <span>
                    {questao.pensamentos.length}{' '}
                    {questao.pensamentos.length === 1
                      ? 'pensamento'
                      : 'pensamentos'}
                  </span>
                </Badge>
              ) : null}
            </div>
          </div>
        </button>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-9 lg:pl-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={classificarMutation.isPending}
            onClick={() => handleQuickResultadoClick('ACERTEI')}
            className={cn(
              'h-8 gap-1.5 text-xs',
              questao.resultado === 'ACERTEI' &&
                'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400'
            )}
          >
            {pendingResultado === 'ACERTEI' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            <span>Acertei</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={classificarMutation.isPending}
            onClick={() => handleQuickResultadoClick('PARCIAL')}
            className={cn(
              'h-8 gap-1.5 text-xs',
              questao.resultado === 'PARCIAL' &&
                'border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-400'
            )}
          >
            {pendingResultado === 'PARCIAL' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            <span>Parcial</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={classificarMutation.isPending}
            onClick={() => handleQuickResultadoClick('ERREI')}
            className={cn(
              'h-8 gap-1.5 text-xs',
              questao.resultado === 'ERREI' &&
                'border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-400'
            )}
          >
            {pendingResultado === 'ERREI' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            <span>Errei</span>
          </Button>
        </div>
      </div>

      {isExpanded ? (
        <div className="animate-accordion-down space-y-5 border-t border-border/60 bg-muted/30 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <section
              aria-label="Temas e pós-revisão da questão"
              className="space-y-4 rounded-xl border border-border bg-card p-4 lg:col-span-6"
            >
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Temas vinculados
                </Label>
                <TemaSelector
                  mode="multiple"
                  value={selectedTemaIds}
                  initialSelectedTemas={questao.temas}
                  disabled={classificarMutation.isPending}
                  onChange={(nextIds) => setSelectedTemaIds(nextIds)}
                  placeholder="Buscar tema existente ou criar novo..."
                />
              </div>

              {isParcialOuErrei ? (
                <div className="space-y-2.5 border-t border-border/60 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor={`pos-revisao-${questao.id}`}
                      className="text-sm font-semibold text-foreground"
                    >
                      Observação Pós-Revisão
                    </Label>
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {draftObservacao.length}/5000
                    </span>
                  </div>

                  <Textarea
                    id={`pos-revisao-${questao.id}`}
                    rows={4}
                    maxLength={5000}
                    disabled={classificarMutation.isPending}
                    value={draftObservacao}
                    onChange={(event) => {
                      setDraftObservacao(event.target.value);
                      if (observacaoError) {
                        setObservacaoError(null);
                      }
                    }}
                    placeholder="Anote o que resolvia a questão, onde travou ou a técnica correta para futura revisão no Caderno de Erros..."
                  />

                  {observacaoError ? (
                    <p className="text-xs text-rose-600 dark:text-rose-400">
                      {observacaoError}
                    </p>
                  ) : (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Sincronizada automaticamente com o Caderno de Erros sem
                      contar como revisão dos temas vinculados.
                    </p>
                  )}

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        classificarMutation.isPending || !hasDirtyClassification
                      }
                      onClick={() => {
                        if (questao.resultado) {
                          void executeClassificacao(
                            questao.resultado,
                            selectedTemaIds,
                            draftObservacao
                          );
                        }
                      }}
                      className="w-full gap-1.5 sm:w-auto"
                    >
                      {classificarMutation.isPending ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          strokeWidth={1.75}
                        />
                      ) : (
                        <Save className="h-3.5 w-3.5" strokeWidth={1.75} />
                      )}
                      <span>Salvar Pós-Revisão</span>
                    </Button>
                  </div>
                </div>
              ) : questao.resultado === 'ACERTEI' ? (
                <div className="space-y-3 border-t border-border/60 pt-4">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Questão classificada como <strong>Acertei</strong>: a data de
                    última revisão dos temas vinculados foi atualizada como{' '}
                    <strong>Finalizado Sozinho</strong>.
                  </p>
                  {hasDirtyTemas ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        disabled={classificarMutation.isPending}
                        onClick={() =>
                          void executeClassificacao(
                            'ACERTEI',
                            selectedTemaIds,
                            null
                          )
                        }
                        className="w-full gap-1.5 sm:w-auto"
                      >
                        <Save className="h-3.5 w-3.5" strokeWidth={1.75} />
                        <span>Atualizar temas vinculados</span>
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
                  Selecione acima entre <strong>Acertei</strong>,{' '}
                  <strong>Parcial</strong> ou <strong>Errei</strong> para salvar
                  a classificação. Caso marque Parcial ou Errei, o campo de
                  Pós-Revisão será liberado aqui.
                </p>
              )}
            </section>

            <section
              aria-label="Pensamentos registrados durante a prova"
              className="space-y-3 rounded-xl border border-border bg-card p-4 lg:col-span-6"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Clock
                    className="h-4 w-4 shrink-0 text-primary"
                    strokeWidth={1.75}
                  />
                  <span>
                    Pensamentos da prova ({sortedPensamentos.length})
                  </span>
                </div>
              </div>

              {sortedPensamentos.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs leading-relaxed text-muted-foreground">
                  Nenhum pensamento registrado para esta questão durante o
                  simulado.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {sortedPensamentos.map((pensamento) => {
                    const formattedStamp = formatTempoDecorrido(
                      pensamento.tempoDecorridoSegundos
                    );

                    return (
                      <li
                        key={pensamento.id}
                        className="space-y-1.5 rounded-xl border border-border/70 bg-muted/30 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="shrink-0 rounded-md border border-border bg-card px-2 py-0.5 font-mono text-xs font-medium text-foreground tabular-nums">
                            [{formattedStamp ?? '--:--'}]
                          </span>

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
                              <Pencil
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
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
                              <Trash2
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                            </Button>
                          </div>
                        </div>

                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                          {pensamento.descricao}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}

      <PensamentoEditDialog
        open={Boolean(editingPensamento)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setEditingPensamento(null);
          }
        }}
        simuladoId={simuladoId}
        pensamento={editingPensamento}
        questoes={questoesList}
      />

      <AlertDialog
        open={confirmAcerteiOpen}
        onOpenChange={(nextOpen) => {
          if (!classificarMutation.isPending) {
            setConfirmAcerteiOpen(nextOpen);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar questão como Acertei?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao alterar para <strong>Acertei</strong>, a observação de
              pós-revisão desta questão será descartada, o registro vinculado no
              Caderno de Erros (caso exista) será removido e os temas vinculados
              terão a última revisão atualizada para hoje como Finalizado
              Sozinho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={classificarMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={classificarMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmAcertei();
              }}
            >
              {classificarMutation.isPending ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Confirmar Acertei</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              Deseja excluir permanentemente este pensamento registrado durante
              a prova?
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
                void handleConfirmDeletePensamento();
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
    </article>
  );
}
