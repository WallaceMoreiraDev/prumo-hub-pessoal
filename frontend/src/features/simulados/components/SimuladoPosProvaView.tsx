import { useCallback, useEffect, useMemo, useState } from 'react';
import { UpdateSimuladoSchema } from '@shared/schemas/simulados.schema';
import type { SimuladoDetalheDto } from '@shared/types/simulados.types';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCode2,
  FileText,
  ListChecks,
  Loader2,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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
import { Input } from '@/components/ui/input';
import { SimuladoExportIaDialog } from '@/features/simulados/components/SimuladoExportIaDialog';
import { SimuladoQuestaoPosRow } from '@/features/simulados/components/SimuladoQuestaoPosRow';
import {
  useDeleteSimuladoMutation,
  useRefreshSimuladoPdfUrlMutation,
  useUpdateSimuladoMutation,
} from '@/features/simulados/hooks/useSimulados';
import {
  SIMULADO_STATUS_LABELS,
  formatClockDuration,
  formatConfiguredDuration,
  summarizeSimuladoResultados,
} from '@/features/simulados/utils/simulados';
import { formatLocalDateTime } from '@/lib/date';
import { getValidationFieldErrors } from '@/lib/errorMessages';

export interface SimuladoPosProvaViewProps {
  simulado: SimuladoDetalheDto;
}

export function SimuladoPosProvaView({ simulado }: SimuladoPosProvaViewProps) {
  const navigate = useNavigate();

  const updateSimuladoMutation = useUpdateSimuladoMutation();
  const deleteSimuladoMutation = useDeleteSimuladoMutation();
  const refreshPdfMutation = useRefreshSimuladoPdfUrlMutation();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(simulado.titulo);
  const [titleError, setTitleError] = useState<string | null>(null);

  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(
    simulado.pdfSignedUrl
  );
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [expandedQuestaoIds, setExpandedQuestaoIds] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    setLocalPdfUrl(simulado.pdfSignedUrl);
  }, [simulado.pdfSignedUrl, simulado.pdfStoragePath]);

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(simulado.titulo);
    }
  }, [simulado.titulo, isEditingTitle]);

  const sortedQuestoes = useMemo(
    () =>
      [...simulado.questoes].sort((a, b) => {
        if (a.ordem !== b.ordem) {
          return a.ordem - b.ordem;
        }
        return a.createdAt.localeCompare(b.createdAt);
      }),
    [simulado.questoes]
  );

  const resumo = useMemo(
    () => summarizeSimuladoResultados(sortedQuestoes),
    [sortedQuestoes]
  );

  const totalPensamentos = useMemo(
    () => sortedQuestoes.reduce((acc, q) => acc + q.pensamentos.length, 0),
    [sortedQuestoes]
  );

  const handleToggleExpand = useCallback((questaoId: string) => {
    setExpandedQuestaoIds((prev) => {
      const next = new Set(prev);
      if (next.has(questaoId)) {
        next.delete(questaoId);
      } else {
        next.add(questaoId);
      }
      return next;
    });
  }, []);

  const handleEnsureExpanded = useCallback((questaoId: string) => {
    setExpandedQuestaoIds((prev) => {
      if (prev.has(questaoId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(questaoId);
      return next;
    });
  }, []);

  async function handleSaveTitle(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    if (updateSimuladoMutation.isPending) {
      return;
    }

    const parsed = UpdateSimuladoSchema.safeParse({ titulo: titleDraft });
    if (!parsed.success) {
      setTitleError(
        parsed.error.issues[0]?.message ?? 'Título do simulado inválido.'
      );
      return;
    }

    setTitleError(null);
    try {
      await updateSimuladoMutation.mutateAsync({
        id: simulado.id,
        input: { titulo: parsed.data.titulo },
      });
      setIsEditingTitle(false);
    } catch (error) {
      const fields = getValidationFieldErrors(error);
      if (fields.titulo) {
        setTitleError(fields.titulo);
      }
    }
  }

  async function handleRefreshPdfUrl(): Promise<void> {
    if (refreshPdfMutation.isPending) {
      return;
    }
    try {
      const result = await refreshPdfMutation.mutateAsync(simulado.id);
      setLocalPdfUrl(result.signedUrl);
      toast.success('Link do PDF atualizado.');
    } catch {
      // Erro tratado via toast no hook.
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (deleteSimuladoMutation.isPending) {
      return;
    }

    try {
      await deleteSimuladoMutation.mutateAsync(simulado.id);
      setConfirmDeleteOpen(false);
      navigate('/simulados', { replace: true });
    } catch {
      // Erro tratado via toast no hook.
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1.5">
          <Link to="/simulados">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            <span>Voltar para Simulados</span>
          </Link>
        </Button>

        <Badge variant="success">{SIMULADO_STATUS_LABELS[simulado.status]}</Badge>
      </div>

      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          {isEditingTitle ? (
            <form onSubmit={handleSaveTitle} noValidate className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  autoFocus
                  maxLength={160}
                  disabled={updateSimuladoMutation.isPending}
                  value={titleDraft}
                  onChange={(event) => {
                    setTitleDraft(event.target.value);
                    if (titleError) {
                      setTitleError(null);
                    }
                  }}
                  aria-label="Editar título do simulado"
                  className="max-w-xl font-semibold"
                />
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={updateSimuladoMutation.isPending}
                    onClick={() => {
                      setIsEditingTitle(false);
                      setTitleDraft(simulado.titulo);
                      setTitleError(null);
                    }}
                    className="gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>Cancelar</span>
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={updateSimuladoMutation.isPending}
                    className="gap-1.5"
                  >
                    {updateSimuladoMutation.isPending ? (
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        strokeWidth={1.75}
                      />
                    ) : (
                      <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                    )}
                    <span>Salvar</span>
                  </Button>
                </div>
              </div>
              {titleError ? (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {titleError}
                </p>
              ) : null}
            </form>
          ) : (
            <div className="flex flex-wrap items-start gap-2">
              <h1 className="min-w-0 max-w-full break-words text-xl font-bold tracking-tight sm:text-2xl">
                {simulado.titulo}
              </h1>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setTitleDraft(simulado.titulo);
                  setTitleError(null);
                  setIsEditingTitle(true);
                }}
                aria-label="Editar título do simulado"
                title="Editar título"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </div>
          )}

          <p className="text-sm leading-relaxed text-muted-foreground">
            Classifique cada questão para sincronizar automaticamente o Caderno
            de Erros e o histórico de revisão dos seus Temas.
          </p>
        </div>

        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
          {simulado.hasPdf ? (
            localPdfUrl ? (
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <a href={localPdfUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                  <span>Abrir PDF</span>
                </a>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={refreshPdfMutation.isPending}
                onClick={() => void handleRefreshPdfUrl()}
                className="gap-1.5"
              >
                {refreshPdfMutation.isPending ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : (
                  <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                )}
                <span>Carregar PDF</span>
              </Button>
            )
          ) : null}

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => setExportDialogOpen(true)}
            className="gap-1.5"
          >
            <FileCode2 className="h-4 w-4" strokeWidth={1.75} />
            <span>Exportar para IA</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirmDeleteOpen(true)}
            className="gap-1.5 text-muted-foreground hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            <span>Excluir</span>
          </Button>
        </div>
      </header>

      <section
        aria-label="Resumo da execução do simulado"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Timer className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
            <span>Tempo gasto / Configurado</span>
          </div>
          <p className="font-mono text-base font-semibold text-foreground tabular-nums">
            {formatClockDuration(simulado.tempoGastoSegundos)}
          </p>
          <p className="text-xs text-muted-foreground">
            Configurado:{' '}
            {formatConfiguredDuration(simulado.duracaoConfiguradaSegundos)}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
            <span>Encerramento</span>
          </div>
          <p className="text-sm font-semibold text-foreground">
            {formatLocalDateTime(simulado.finishedAt)}
          </p>
          <p className="text-xs text-muted-foreground">
            Início: {formatLocalDateTime(simulado.startedAt)}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CheckCircle2
              className="h-3.5 w-3.5 text-primary"
              strokeWidth={1.75}
            />
            <span>Classificação</span>
          </div>
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {resumo.classificadas} de {resumo.total}{' '}
            {resumo.total === 1 ? 'questão' : 'questões'}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums">
            <span className="text-emerald-600 dark:text-emerald-400">
              {resumo.acertos} Acertei
            </span>
            <span className="text-muted-foreground" aria-hidden="true">
              ·
            </span>
            <span className="text-amber-600 dark:text-amber-400">
              {resumo.parciais} Parcial
            </span>
            <span className="text-muted-foreground" aria-hidden="true">
              ·
            </span>
            <span className="text-rose-600 dark:text-rose-400">
              {resumo.erros} Errei
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MessageSquareText
              className="h-3.5 w-3.5 text-primary"
              strokeWidth={1.75}
            />
            <span>Registros da prova</span>
          </div>
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {totalPensamentos}{' '}
            {totalPensamentos === 1 ? 'pensamento' : 'pensamentos'}
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span>{simulado.hasPdf ? 'PDF disponível' : 'Sem PDF anexado'}</span>
          </p>
        </div>
      </section>

      <section
        aria-label="Questões do simulado para revisão pós-prova"
        className="space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" strokeWidth={1.75} />
            <h2 className="text-lg font-semibold tracking-tight">
              Questões ({sortedQuestoes.length})
            </h2>
          </div>

          {sortedQuestoes.length > 0 ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setExpandedQuestaoIds(
                    expandedQuestaoIds.size === sortedQuestoes.length
                      ? new Set()
                      : new Set(sortedQuestoes.map((q) => q.id))
                  )
                }
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>
                  {expandedQuestaoIds.size === sortedQuestoes.length
                    ? 'Recolher todas'
                    : 'Expandir todas'}
                </span>
              </Button>
            </div>
          ) : null}
        </div>

        {sortedQuestoes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma questão encontrada neste simulado.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedQuestoes.map((questao) => (
              <SimuladoQuestaoPosRow
                key={questao.id}
                simuladoId={simulado.id}
                questao={questao}
                questoesList={sortedQuestoes}
                isExpanded={expandedQuestaoIds.has(questao.id)}
                onToggleExpand={handleToggleExpand}
                onEnsureExpanded={handleEnsureExpanded}
              />
            ))}
          </div>
        )}
      </section>

      <SimuladoExportIaDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        simuladoId={simulado.id}
        simuladoTitulo={simulado.titulo}
      />

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={(nextOpen) => {
          if (!deleteSimuladoMutation.isPending) {
            setConfirmDeleteOpen(nextOpen);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir simulado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{' '}
              <strong className="font-semibold text-foreground">
                {simulado.titulo}
              </strong>
              ? Esta ação remove permanentemente questões, pensamentos, PDF e
              eventuais registros vinculados no Caderno de Erros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSimuladoMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteSimuladoMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSimuladoMutation.isPending ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Excluindo...</span>
                </>
              ) : (
                <span>Excluir permanentemente</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
