import { useCallback, useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateExercicioAvulsoSchema } from '@shared/schemas/exercicios.schema';
import type { ReviewMode } from '@shared/types/enums.types';
import type {
  ExercicioAvulsoDetalheDto,
  ExercicioAvulsoSummaryDto,
} from '@shared/types/exercicios.types';
import type { LousaSummaryDto } from '@shared/types/lousas.types';
import type { TemaSummaryDto } from '@shared/types/temas.types';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Timer,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { MarkdownEditorField } from '@/components/markdown/MarkdownEditorField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cadernoErrosApi } from '@/features/caderno-erros/api/cadernoErrosApi';
import { lousasApi } from '@/features/lousas/api/lousasApi';
import { LousaAttachmentField } from '@/features/lousas/components/LousaAttachmentField';
import { LousaCanvasModal } from '@/features/lousas/components/LousaCanvasModal';
import {
  useCreateExercicioMutation,
  useUpdateExercicioMutation,
} from '@/features/exercicios/hooks/useExercicios';
import { TemaSelector } from '@/features/temas-revisao/components/TemaSelector';
import { cn } from '@/lib/utils';

export interface ExercicioExecucaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingExercicio?: ExercicioAvulsoDetalheDto | ExercicioAvulsoSummaryDto | null;
  defaultTemaIds?: string[];
  initialTemas?: TemaSummaryDto[];
  onSuccess?: (exercicio: ExercicioAvulsoDetalheDto) => void;
}

function formatStopwatch(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function ExercicioExecucaoModal({
  open,
  onOpenChange,
  editingExercicio = null,
  defaultTemaIds = [],
  initialTemas = [],
  onSuccess,
}: ExercicioExecucaoModalProps) {
  const isEditing = Boolean(editingExercicio);
  const createMutation = useCreateExercicioMutation();
  const updateMutation = useUpdateExercicioMutation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Estado do cronômetro progressivo
  const [secondsElapsed, setSecondsElapsed] = useState<number>(
    editingExercicio?.duracaoSegundos ?? 0
  );
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(!isEditing);

  // Estados de lousa e temas
  const [attachedLousa, setAttachedLousa] = useState<LousaSummaryDto | null>(
    editingExercicio?.lousa ?? null
  );
  const [isLousaEditorOpen, setIsLousaEditorOpen] = useState(false);
  const [selectedTemas, setSelectedTemas] = useState<TemaSummaryDto[]>(
    () => editingExercicio?.temas ?? initialTemas ?? []
  );

  // Checkbox opcional para Caderno de Erros
  const [criarNoCadernoErros, setCriarNoCadernoErros] = useState(false);

  // Refs de gerenciamento de ciclo de vida e lousas temporárias
  const sessionCreatedLousaIdsRef = useRef<Set<string>>(new Set());
  const wasOpenRef = useRef(false);
  const lastLoadedIdRef = useRef<string | null>(null);
  const lastLoadedDataKeyRef = useRef<string | null>(null);

  const cleanupOrphanLousas = useCallback(() => {
    const ids = Array.from(sessionCreatedLousaIdsRef.current);
    sessionCreatedLousaIdsRef.current.clear();
    for (const id of ids) {
      void lousasApi.deleteLousa(id).catch(() => undefined);
    }
  }, []);

  type ExercicioFormInput = z.input<typeof CreateExercicioAvulsoSchema>;
  type ExercicioFormOutput = z.output<typeof CreateExercicioAvulsoSchema>;

  const form = useForm<ExercicioFormInput, unknown, ExercicioFormOutput>({
    resolver: zodResolver(CreateExercicioAvulsoSchema),
    defaultValues: {
      titulo: editingExercicio?.titulo ?? '',
      enunciado:
        (editingExercicio && 'enunciado' in editingExercicio
          ? editingExercicio.enunciado
          : null) ?? null,
      linkExterno:
        (editingExercicio && 'linkExterno' in editingExercicio
          ? editingExercicio.linkExterno
          : null) ?? null,
      observacao:
        (editingExercicio && 'observacao' in editingExercicio
          ? editingExercicio.observacao
          : null) ?? null,
      duracaoSegundos: editingExercicio?.duracaoSegundos ?? 0,
      desfecho: editingExercicio?.desfecho ?? null,
      lousaId: editingExercicio?.lousa?.id ?? null,
      temaIds:
        editingExercicio?.temas.map((t) => t.id) ??
        (defaultTemaIds.length > 0
          ? defaultTemaIds
          : initialTemas.map((t) => t.id)),
    },
  });

  const watchedEnunciado = form.watch('enunciado') ?? '';
  const watchedObservacao = form.watch('observacao') ?? '';
  const watchedLousaId = form.watch('lousaId') ?? null;
  const watchedTemaIds = form.watch('temaIds') ?? [];

  // Reset de formulário ao abrir/fechar e sincronização de dados de edição
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (!open) {
      lastLoadedIdRef.current = null;
      lastLoadedDataKeyRef.current = null;
      setIsLousaEditorOpen(false);
      setIsTimerRunning(false);
      return;
    }

    if (!isEditing) {
      if (justOpened) {
        lastLoadedIdRef.current = null;
        lastLoadedDataKeyRef.current = null;
        sessionCreatedLousaIdsRef.current.clear();
        setIsLousaEditorOpen(false);
        setCriarNoCadernoErros(false);

        setSecondsElapsed(0);
        setIsTimerRunning(true);

        setAttachedLousa(null);
        setSelectedTemas(initialTemas ?? []);

        form.reset({
          titulo: '',
          enunciado: null,
          linkExterno: null,
          observacao: null,
          duracaoSegundos: 0,
          desfecho: null,
          lousaId: null,
          temaIds:
            defaultTemaIds.length > 0
              ? defaultTemaIds
              : (initialTemas ?? []).map((t) => t.id),
        });
      }
      return;
    }

    // Modo de Edição (isEditing === true && Boolean(editingExercicio))
    if (editingExercicio) {
      const currentDataKey = `${editingExercicio.id}:${editingExercicio.duracaoSegundos}:${'enunciado' in editingExercicio ? (editingExercicio.enunciado ?? '') : ''}:${'observacao' in editingExercicio ? (editingExercicio.observacao ?? '') : ''}:${'linkExterno' in editingExercicio ? (editingExercicio.linkExterno ?? '') : ''}:${editingExercicio.lousa?.id ?? ''}`;

      const shouldHydrate =
        justOpened ||
        editingExercicio.id !== lastLoadedIdRef.current ||
        currentDataKey !== lastLoadedDataKeyRef.current;

      if (shouldHydrate) {
        const isNewId = editingExercicio.id !== lastLoadedIdRef.current;
        lastLoadedIdRef.current = editingExercicio.id;
        lastLoadedDataKeyRef.current = currentDataKey;

        if (justOpened || isNewId) {
          sessionCreatedLousaIdsRef.current.clear();
          setIsLousaEditorOpen(false);
          setCriarNoCadernoErros(false);
        }

        const duracao = editingExercicio.duracaoSegundos ?? 0;
        setSecondsElapsed(duracao);
        // Regra inegociável do cronômetro em edição: sempre pausado
        setIsTimerRunning(false);

        setAttachedLousa(editingExercicio.lousa ?? null);
        const temas = editingExercicio.temas ?? initialTemas ?? [];
        setSelectedTemas(temas);

        form.reset({
          titulo: editingExercicio.titulo ?? '',
          enunciado:
            ('enunciado' in editingExercicio
              ? editingExercicio.enunciado
              : null) ?? null,
          linkExterno:
            ('linkExterno' in editingExercicio
              ? editingExercicio.linkExterno
              : null) ?? null,
          observacao:
            ('observacao' in editingExercicio
              ? editingExercicio.observacao
              : null) ?? null,
          duracaoSegundos: duracao,
          desfecho: editingExercicio.desfecho ?? null,
          lousaId: editingExercicio.lousa?.id ?? null,
          temaIds:
            editingExercicio.temas?.map((t) => t.id) ??
            (defaultTemaIds.length > 0
              ? defaultTemaIds
              : (initialTemas ?? []).map((t) => t.id)),
        });
      }
    }
  }, [open, editingExercicio, initialTemas, defaultTemaIds, isEditing, form]);

  // Loop do cronômetro progressivo
  useEffect(() => {
    if (
      !open ||
      !isTimerRunning ||
      isLousaEditorOpen ||
      process.env.NODE_ENV === 'test'
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsElapsed((prev) => {
        const next = prev + 1;
        form.setValue('duracaoSegundos', next, { shouldValidate: false });
        return next;
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [open, isTimerRunning, isLousaEditorOpen, form]);

  const handleToggleTimer = useCallback(() => {
    setIsTimerRunning((prev) => !prev);
  }, []);

  const handleResetTimer = useCallback(() => {
    setIsTimerRunning(false);
    setSecondsElapsed(0);
    form.setValue('duracaoSegundos', 0, { shouldValidate: true });
  }, [form]);

  const handleAddMinutes = useCallback(
    (minutes: number) => {
      setSecondsElapsed((prev) => {
        const next = Math.max(0, prev + minutes * 60);
        form.setValue('duracaoSegundos', next, { shouldValidate: true });
        return next;
      });
    },
    [form]
  );

  const handleClose = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    cleanupOrphanLousas();
    setIsTimerRunning(false);
    setIsLousaEditorOpen(false);
    onOpenChange(false);
  }, [isSubmitting, cleanupOrphanLousas, onOpenChange]);

  const handleAttachLousa = useCallback(
    (savedLousa: LousaSummaryDto) => {
      sessionCreatedLousaIdsRef.current.add(savedLousa.id);
      setAttachedLousa(savedLousa);
      form.setValue('lousaId', savedLousa.id, { shouldValidate: true });
    },
    [form]
  );

  const handleRemoveLousa = useCallback(() => {
    const currentId = form.getValues('lousaId');
    if (currentId && sessionCreatedLousaIdsRef.current.has(currentId)) {
      void lousasApi.deleteLousa(currentId).catch(() => undefined);
      sessionCreatedLousaIdsRef.current.delete(currentId);
    }
    setAttachedLousa(null);
    form.setValue('lousaId', null, { shouldValidate: true });
  }, [form]);

  // Submissão com desfecho específico (SOLO, HELP, ou sem desfecho)
  const submitWithDesfecho = useCallback(
    async (desfecho: ReviewMode | null) => {
      form.setValue('desfecho', desfecho);
      form.setValue('duracaoSegundos', secondsElapsed);

      const isValid = await form.trigger();
      if (!isValid) {
        toast.error('Preencha os campos obrigatórios corretamente.');
        return;
      }

      const values = form.getValues();

      try {
        let resultado: ExercicioAvulsoDetalheDto;

        if (isEditing && editingExercicio) {
          resultado = await updateMutation.mutateAsync({
            id: editingExercicio.id,
            payload: {
              titulo: values.titulo,
              enunciado: values.enunciado || null,
              linkExterno: values.linkExterno || null,
              observacao: values.observacao || null,
              duracaoSegundos: secondsElapsed,
              desfecho,
              lousaId: values.lousaId || null,
              temaIds: values.temaIds,
            },
          });
        } else {
          resultado = await createMutation.mutateAsync({
            titulo: values.titulo,
            enunciado: values.enunciado || null,
            linkExterno: values.linkExterno || null,
            observacao: values.observacao || null,
            duracaoSegundos: secondsElapsed,
            desfecho,
            lousaId: values.lousaId || null,
            temaIds: values.temaIds,
          });

          // Se marcado para salvar no Caderno de Erros simultaneamente
          if (criarNoCadernoErros) {
            try {
              if (values.linkExterno) {
                await cadernoErrosApi.createManualErro({
                  origem: 'EXTERNAL_LINK',
                  codigoReferencia: values.titulo.slice(0, 40),
                  linkExterno: values.linkExterno,
                  titulo: values.titulo,
                  temaIds: values.temaIds,
                  observacaoErro: values.observacao || values.enunciado || null,
                  lousaId: values.lousaId || null,
                });
              } else {
                await cadernoErrosApi.createManualErro({
                  origem: 'GENERIC_FULL',
                  titulo: values.titulo,
                  enunciadoCompleto: values.enunciado || values.titulo,
                  linkExterno: null,
                  temaIds: values.temaIds,
                  observacaoErro: values.observacao || null,
                  lousaId: values.lousaId || null,
                });
              }
              toast.info('Item cadastrado no Caderno de Erros como pendente.');
            } catch {
              toast.warning(
                'Exercício salvo, mas houve falha ao enviar para o Caderno de Erros.'
              );
            }
          }
        }

        sessionCreatedLousaIdsRef.current.clear();
        setIsTimerRunning(false);
        onOpenChange(false);
        onSuccess?.(resultado);
      } catch {
        // Erro já tratado nas mutations com toast
      }
    },
    [
      form,
      secondsElapsed,
      isEditing,
      editingExercicio,
      updateMutation,
      createMutation,
      criarNoCadernoErros,
      onOpenChange,
      onSuccess,
    ]
  );

  return (
    <>
      <Dialog
        open={open && !isLousaEditorOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleClose();
          } else {
            onOpenChange(true);
          }
        }}
      >
        <DialogContent
          className="max-h-[92vh] max-w-3xl overflow-y-auto sm:max-h-[88vh]"
          onPointerDownOutside={(e) => {
            if (isSubmitting) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (isSubmitting) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <Timer className="h-5 w-5" strokeWidth={1.75} />
              <DialogTitle className="text-lg font-bold tracking-tight">
                {isEditing ? 'Editar Exercício de Estudo' : 'Sessão de Exercício Avulso'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Cronometre a resolução do problema, anote raciocínios e atualize o
              radar de revisão dos temas estudados.
            </DialogDescription>
          </DialogHeader>

          {/* Painel do Cronômetro de Foco */}
          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-3.5 sm:flex-row sm:px-5">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl border transition-colors',
                  isTimerRunning
                    ? 'border-primary/40 bg-primary/10 text-primary animate-pulse'
                    : 'border-border bg-card text-muted-foreground'
                )}
              >
                <Clock className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Tempo Dedicado
                </p>
                <p className="font-mono text-2xl font-bold tracking-tight text-foreground">
                  {formatStopwatch(secondsElapsed)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant={isTimerRunning ? 'secondary' : 'default'}
                size="sm"
                onClick={handleToggleTimer}
                disabled={isSubmitting}
                className="gap-1.5"
              >
                {isTimerRunning ? (
                  <>
                    <Pause className="h-3.5 w-3.5" strokeWidth={2} />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" strokeWidth={2} />
                    <span>{secondsElapsed > 0 ? 'Retomar' : 'Iniciar'}</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetTimer}
                disabled={isSubmitting || secondsElapsed === 0}
                className="gap-1 text-muted-foreground hover:text-foreground"
                title="Zerar cronômetro"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Zerar</span>
              </Button>

              <div className="hidden h-4 w-px bg-border sm:block" />

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddMinutes(5)}
                  disabled={isSubmitting}
                  className="h-8 px-2 text-xs"
                >
                  +5m
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddMinutes(15)}
                  disabled={isSubmitting}
                  className="h-8 px-2 text-xs"
                >
                  +15m
                </Button>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitWithDesfecho(form.getValues('desfecho') ?? null);
            }}
            className="space-y-4 pt-1"
          >
            {/* Título do Exercício */}
            <div className="space-y-1.5">
              <Label htmlFor="exercicio-titulo" className="text-xs font-semibold">
                Título ou Referência da Questão <span className="text-primary">*</span>
              </Label>
              <Input
                id="exercicio-titulo"
                placeholder="Ex.: Codeforces 1899A - Game with Integers ou ENEM 2023 Q138"
                maxLength={160}
                disabled={isSubmitting}
                {...form.register('titulo')}
              />
              {form.formState.errors.titulo ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.titulo.message}
                </p>
              ) : null}
            </div>

            {/* Seleção de Temas (Obrigatório >= 1) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Temas Abordados <span className="text-primary">*</span>
              </Label>
              <TemaSelector
                mode="multiple"
                value={watchedTemaIds}
                initialSelectedTemas={selectedTemas}
                disabled={isSubmitting}
                placeholder="Buscar ou criar temas envolvidos no exercício..."
                onChange={(nextIds, nextTemas) => {
                  form.setValue('temaIds', nextIds, { shouldValidate: true });
                  if (nextTemas) {
                    setSelectedTemas(nextTemas);
                  }
                }}
              />
              {form.formState.errors.temaIds ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.temaIds.message}
                </p>
              ) : null}
            </div>

            {/* Enunciado da Questão (Markdown com KaTeX) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Enunciado ou Descrição do Problema (Opcional)
              </Label>
              <MarkdownEditorField
                placeholder="Cole o enunciado em Markdown, texto puro ou fórmulas matemáticas LaTeX..."
                previewContent={watchedEnunciado}
                disabled={isSubmitting}
                rows={4}
                {...form.register('enunciado')}
              />
              {form.formState.errors.enunciado ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.enunciado.message}
                </p>
              ) : null}
            </div>

            {/* Link Externo */}
            <div className="space-y-1.5">
              <Label htmlFor="exercicio-link" className="text-xs font-semibold">
                Link do Problema / Plataforma (Opcional)
              </Label>
              <div className="relative">
                <ExternalLink className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="exercicio-link"
                  type="url"
                  placeholder="https://codeforces.com/..."
                  className="pl-9"
                  disabled={isSubmitting}
                  {...form.register('linkExterno')}
                />
              </div>
              {form.formState.errors.linkExterno ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.linkExterno.message}
                </p>
              ) : null}
            </div>

            {/* Lousa Universal (Diagramas/Cálculos) */}
            <div className="rounded-xl border border-border/80 bg-card/60 p-3">
              <LousaAttachmentField
                label="Lousa de Rascunho / Diagramação"
                helperText="Esboce grafos, diagramas de blocos, matrizes ou equações manuais para este exercício."
                lousaId={watchedLousaId}
                lousaPreview={attachedLousa}
                disabled={isSubmitting}
                onRequestOpenEditor={() => setIsLousaEditorOpen(true)}
                onRemoveLousa={handleRemoveLousa}
              />
            </div>

            {/* Observações da Resolução */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Anotações de Resolução, Complexidade ou Aprendizado (Opcional)
              </Label>
              <MarkdownEditorField
                placeholder="Explique a ideia da solução, armadilhas encontradas ou complexidade de tempo/espaço..."
                previewContent={watchedObservacao}
                disabled={isSubmitting}
                rows={4}
                {...form.register('observacao')}
              />
              {form.formState.errors.observacao ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.observacao.message}
                </p>
              ) : null}
            </div>

            {/* Checkbox para enviar também ao Caderno de Erros */}
            {!isEditing ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-3">
                <input
                  id="criar-no-caderno"
                  type="checkbox"
                  checked={criarNoCadernoErros}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCriarNoCadernoErros(e.target.checked)
                  }
                  disabled={isSubmitting}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <div className="space-y-0.5 text-xs">
                  <Label
                    htmlFor="criar-no-caderno"
                    className="cursor-pointer font-medium text-foreground"
                  >
                    Registrar também como pendência no Caderno de Erros
                  </Label>
                  <p className="text-muted-foreground">
                    Marque caso você tenha tido dificuldade ou errado o problema e
                    queira agendá-lo para re-resolução futura.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Rodapé com Ações de Desfecho */}
            <DialogFooter className="flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {/* Apenas Salvar (Sem desfecho / Sem alterar data de revisão) */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => submitWithDesfecho(null)}
                  className="gap-1.5 text-xs"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  <span>Apenas Salvar Estudo</span>
                </Button>

                {/* Com Ajuda (HELP) */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => submitWithDesfecho('HELP')}
                  className="gap-1.5 border-amber-500/40 bg-amber-500/10 text-xs font-semibold text-amber-700 hover:bg-amber-500/20 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  <span>Resolvi com Ajuda (Help)</span>
                </Button>

                {/* Finalizado Sozinho (SOLO) */}
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => submitWithDesfecho('SOLO')}
                  className="gap-1.5 text-xs font-semibold"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  <span>Resolvi Sozinho (Solo)</span>
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Editor da Lousa fora da árvore do Dialog para isolamento e suspensão */}
      {open && isLousaEditorOpen ? (
        <LousaCanvasModal
          open={open && isLousaEditorOpen}
          onOpenChange={setIsLousaEditorOpen}
          lousaId={watchedLousaId}
          title={watchedLousaId ? 'Editar Lousa' : 'Desenhar na Lousa'}
          onSaved={(savedLousa) => {
            handleAttachLousa(savedLousa);
            setIsLousaEditorOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
