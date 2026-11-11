import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CreateSimuladoQuestaoSchema,
  UpdateSimuladoQuestaoSchema,
  UpdateSimuladoSchema,
} from '@shared/schemas/simulados.schema';
import type {
  SimuladoDetalheDto,
  SimuladoQuestaoDto,
} from '@shared/types/simulados.types';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  ExternalLink,
  FileText,
  FileUp,
  ListChecks,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateQuestaoMutation,
  useDeleteQuestaoMutation,
  useDeleteSimuladoMutation,
  useDeleteSimuladoPdfMutation,
  useIniciarSimuladoMutation,
  useRefreshSimuladoPdfUrlMutation,
  useUpdateQuestaoMutation,
  useUpdateSimuladoMutation,
  useUploadSimuladoPdfMutation,
} from '@/features/simulados/hooks/useSimulados';
import {
  SIMULADO_DURATION_PRESETS,
  SIMULADO_MAX_DURATION_SECONDS,
  SIMULADO_STATUS_LABELS,
  formatConfiguredDuration,
  hoursMinutesToSeconds,
  secondsToHoursMinutes,
  validatePdfFileClient,
} from '@/features/simulados/utils/simulados';
import { getValidationFieldErrors } from '@/lib/errorMessages';
import { cn } from '@/lib/utils';

export interface SimuladoPreparacaoViewProps {
  simulado: SimuladoDetalheDto;
}

interface MetadataFieldErrors {
  titulo?: string;
  duration?: string;
}

interface NewQuestaoErrors {
  numeroQuestao?: string;
  tituloQuestao?: string;
  ordem?: string;
}

export function SimuladoPreparacaoView({
  simulado,
}: SimuladoPreparacaoViewProps) {
  const navigate = useNavigate();

  const updateSimuladoMutation = useUpdateSimuladoMutation();
  const deleteSimuladoMutation = useDeleteSimuladoMutation();
  const iniciarMutation = useIniciarSimuladoMutation();
  const uploadPdfMutation = useUploadSimuladoPdfMutation();
  const deletePdfMutation = useDeleteSimuladoPdfMutation();
  const refreshPdfMutation = useRefreshSimuladoPdfUrlMutation();
  const createQuestaoMutation = useCreateQuestaoMutation();
  const updateQuestaoMutation = useUpdateQuestaoMutation();
  const deleteQuestaoMutation = useDeleteQuestaoMutation();

  // Metadados (título + duração) com proteção contra reset de rascunho em refetch
  const initialHm = secondsToHoursMinutes(simulado.duracaoConfiguradaSegundos);
  const [tituloInput, setTituloInput] = useState(simulado.titulo);
  const [hoursInput, setHoursInput] = useState(initialHm.hours);
  const [minutesInput, setMinutesInput] = useState(initialHm.minutes);
  const [metadataErrors, setMetadataErrors] = useState<MetadataFieldErrors>({});

  const serverMetadataRef = useRef({
    id: simulado.id,
    titulo: simulado.titulo,
    duracao: simulado.duracaoConfiguradaSegundos,
  });

  const configuredSecondsDraft = hoursMinutesToSeconds(
    Number.isFinite(hoursInput) ? hoursInput : 0,
    Number.isFinite(minutesInput) ? minutesInput : 0
  );

  const isMetadataDirty =
    tituloInput.trim() !== serverMetadataRef.current.titulo ||
    configuredSecondsDraft !== serverMetadataRef.current.duracao;

  useEffect(() => {
    const idChanged = serverMetadataRef.current.id !== simulado.id;
    const serverChanged =
      idChanged ||
      serverMetadataRef.current.titulo !== simulado.titulo ||
      serverMetadataRef.current.duracao !== simulado.duracaoConfiguradaSegundos;

    if (!serverChanged) {
      return;
    }

    const wasDirtyBeforeSync =
      tituloInput.trim() !== serverMetadataRef.current.titulo ||
      hoursMinutesToSeconds(hoursInput, minutesInput) !==
        serverMetadataRef.current.duracao;

    serverMetadataRef.current = {
      id: simulado.id,
      titulo: simulado.titulo,
      duracao: simulado.duracaoConfiguradaSegundos,
    };

    if (idChanged || !wasDirtyBeforeSync) {
      const hm = secondsToHoursMinutes(simulado.duracaoConfiguradaSegundos);
      setTituloInput(simulado.titulo);
      setHoursInput(hm.hours);
      setMinutesInput(hm.minutes);
      setMetadataErrors({});
    }
  }, [
    simulado.id,
    simulado.titulo,
    simulado.duracaoConfiguradaSegundos,
    tituloInput,
    hoursInput,
    minutesInput,
  ]);

  // PDF controls
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pdfInlineError, setPdfInlineError] = useState<string | null>(null);
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(
    simulado.pdfSignedUrl
  );
  const [confirmRemovePdfOpen, setConfirmRemovePdfOpen] = useState(false);

  useEffect(() => {
    setLocalPdfUrl(simulado.pdfSignedUrl);
  }, [simulado.pdfSignedUrl, simulado.pdfStoragePath]);

  // Questões inline create & edit
  const numeroInputRef = useRef<HTMLInputElement | null>(null);
  const [newNumeroQuestao, setNewNumeroQuestao] = useState('');
  const [newTituloQuestao, setNewTituloQuestao] = useState('');
  const [newOrdemInput, setNewOrdemInput] = useState('');
  const [newQuestaoErrors, setNewQuestaoErrors] = useState<NewQuestaoErrors>({});

  const [editingQuestaoId, setEditingQuestaoId] = useState<string | null>(null);
  const [editNumeroQuestao, setEditNumeroQuestao] = useState('');
  const [editTituloQuestao, setEditTituloQuestao] = useState('');
  const [editOrdemInput, setEditOrdemInput] = useState('');
  const [editQuestaoErrors, setEditQuestaoErrors] =
    useState<NewQuestaoErrors>({});
  const [deletingQuestao, setDeletingQuestao] =
    useState<SimuladoQuestaoDto | null>(null);

  // Start & Delete Simulado dialogs
  const [confirmStartOpen, setConfirmStartOpen] = useState(false);
  const [confirmDeleteSimuladoOpen, setConfirmDeleteSimuladoOpen] =
    useState(false);

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

  async function handleSaveMetadata(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    if (updateSimuladoMutation.isPending) {
      return;
    }

    const nextErrors: MetadataFieldErrors = {};
    if (
      !Number.isInteger(hoursInput) ||
      hoursInput < 0 ||
      hoursInput > 24 ||
      !Number.isInteger(minutesInput) ||
      minutesInput < 0 ||
      minutesInput > 59
    ) {
      nextErrors.duration =
        'Informe horas (0 a 24) e minutos (0 a 59) inteiros válidos.';
    } else if (
      configuredSecondsDraft < 1 ||
      configuredSecondsDraft > SIMULADO_MAX_DURATION_SECONDS
    ) {
      nextErrors.duration =
        'A duração deve estar entre 1 minuto e 24 horas.';
    }

    const parsed = UpdateSimuladoSchema.safeParse({
      titulo: tituloInput,
      duracaoConfiguradaSegundos: configuredSecondsDraft,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (path === 'titulo' && !nextErrors.titulo) {
          nextErrors.titulo = issue.message;
        } else if (
          path === 'duracaoConfiguradaSegundos' &&
          !nextErrors.duration
        ) {
          nextErrors.duration = issue.message;
        }
      }
    }

    if (Object.keys(nextErrors).length > 0 || !parsed.success) {
      setMetadataErrors(nextErrors);
      return;
    }

    setMetadataErrors({});
    try {
      const updated = await updateSimuladoMutation.mutateAsync({
        id: simulado.id,
        input: parsed.data,
      });
      serverMetadataRef.current = {
        id: updated.id,
        titulo: updated.titulo,
        duracao: updated.duracaoConfiguradaSegundos,
      };
      const hm = secondsToHoursMinutes(updated.duracaoConfiguradaSegundos);
      setTituloInput(updated.titulo);
      setHoursInput(hm.hours);
      setMinutesInput(hm.minutes);
    } catch (error) {
      const fieldErrors = getValidationFieldErrors(error);
      setMetadataErrors({
        titulo: fieldErrors.titulo,
        duration: fieldErrors.duracaoConfiguradaSegundos,
      });
    }
  }

  async function handlePdfFileSelected(
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || uploadPdfMutation.isPending) {
      return;
    }

    const validation = validatePdfFileClient(file);
    if (!validation.valid) {
      setPdfInlineError(validation.message);
      toast.error(validation.message);
      return;
    }

    setPdfInlineError(null);
    try {
      const updated = await uploadPdfMutation.mutateAsync({
        id: simulado.id,
        file,
      });
      setLocalPdfUrl(updated.pdfSignedUrl);
    } catch {
      // Erro já notificado via toast no hook.
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
      // Erro já notificado via toast no hook.
    }
  }

  async function handleConfirmRemovePdf(): Promise<void> {
    if (deletePdfMutation.isPending) {
      return;
    }
    try {
      await deletePdfMutation.mutateAsync(simulado.id);
      setLocalPdfUrl(null);
      setConfirmRemovePdfOpen(false);
    } catch {
      // Erro tratado via toast no hook.
    }
  }

  async function handleAddQuestao(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    if (createQuestaoMutation.isPending) {
      return;
    }

    const trimmedOrdem = newOrdemInput.trim();
    let parsedOrdem: number | undefined;
    if (trimmedOrdem.length > 0) {
      const num = Number(trimmedOrdem);
      if (!Number.isInteger(num) || num < 0 || num > 10000) {
        setNewQuestaoErrors({
          ordem: 'A ordem deve ser um número inteiro entre 0 e 10000.',
        });
        return;
      }
      parsedOrdem = num;
    }

    const parsed = CreateSimuladoQuestaoSchema.safeParse({
      numeroQuestao: newNumeroQuestao,
      tituloQuestao: newTituloQuestao,
      ...(parsedOrdem !== undefined ? { ordem: parsedOrdem } : {}),
    });

    if (!parsed.success) {
      const errs: NewQuestaoErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'numeroQuestao' && !errs.numeroQuestao) {
          errs.numeroQuestao = issue.message;
        } else if (key === 'tituloQuestao' && !errs.tituloQuestao) {
          errs.tituloQuestao = issue.message;
        } else if (key === 'ordem' && !errs.ordem) {
          errs.ordem = issue.message;
        }
      }
      setNewQuestaoErrors(errs);
      return;
    }

    setNewQuestaoErrors({});
    try {
      await createQuestaoMutation.mutateAsync({
        simuladoId: simulado.id,
        input: parsed.data,
      });
      setNewNumeroQuestao('');
      setNewTituloQuestao('');
      setNewOrdemInput('');
      numeroInputRef.current?.focus();
    } catch (error) {
      const serverFields = getValidationFieldErrors(error);
      setNewQuestaoErrors({
        numeroQuestao: serverFields.numeroQuestao,
        tituloQuestao: serverFields.tituloQuestao,
        ordem: serverFields.ordem,
      });
    }
  }

  function startEditQuestao(questao: SimuladoQuestaoDto): void {
    setEditingQuestaoId(questao.id);
    setEditNumeroQuestao(questao.numeroQuestao);
    setEditTituloQuestao(questao.tituloQuestao);
    setEditOrdemInput(String(questao.ordem));
    setEditQuestaoErrors({});
  }

  async function handleSaveEditQuestao(questaoId: string): Promise<void> {
    if (updateQuestaoMutation.isPending) {
      return;
    }

    const trimmedOrdem = editOrdemInput.trim();
    const numericOrdem = Number(trimmedOrdem);
    if (
      trimmedOrdem.length === 0 ||
      !Number.isInteger(numericOrdem) ||
      numericOrdem < 0 ||
      numericOrdem > 10000
    ) {
      setEditQuestaoErrors({
        ordem: 'Informe um número inteiro entre 0 e 10000.',
      });
      return;
    }

    const parsed = UpdateSimuladoQuestaoSchema.safeParse({
      numeroQuestao: editNumeroQuestao,
      tituloQuestao: editTituloQuestao,
      ordem: numericOrdem,
    });

    if (!parsed.success) {
      const errs: NewQuestaoErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'numeroQuestao' && !errs.numeroQuestao) {
          errs.numeroQuestao = issue.message;
        } else if (key === 'tituloQuestao' && !errs.tituloQuestao) {
          errs.tituloQuestao = issue.message;
        } else if (key === 'ordem' && !errs.ordem) {
          errs.ordem = issue.message;
        }
      }
      setEditQuestaoErrors(errs);
      return;
    }

    setEditQuestaoErrors({});
    try {
      await updateQuestaoMutation.mutateAsync({
        simuladoId: simulado.id,
        questaoId,
        input: parsed.data,
      });
      setEditingQuestaoId(null);
    } catch (error) {
      const serverFields = getValidationFieldErrors(error);
      setEditQuestaoErrors({
        numeroQuestao: serverFields.numeroQuestao,
        tituloQuestao: serverFields.tituloQuestao,
        ordem: serverFields.ordem,
      });
    }
  }

  async function handleConfirmDeleteQuestao(): Promise<void> {
    if (!deletingQuestao || deleteQuestaoMutation.isPending) {
      return;
    }

    try {
      await deleteQuestaoMutation.mutateAsync({
        simuladoId: simulado.id,
        questaoId: deletingQuestao.id,
      });
      if (editingQuestaoId === deletingQuestao.id) {
        setEditingQuestaoId(null);
      }
      setDeletingQuestao(null);
    } catch {
      // Erro tratado via toast no hook.
    }
  }

  async function handleConfirmStart(): Promise<void> {
    if (iniciarMutation.isPending) {
      return;
    }

    try {
      await iniciarMutation.mutateAsync(simulado.id);
      setConfirmStartOpen(false);
      navigate(`/simulados/${simulado.id}/execucao`, { replace: true });
    } catch {
      // Erro tratado via toast no hook.
    }
  }

  async function handleConfirmDeleteSimulado(): Promise<void> {
    if (deleteSimuladoMutation.isPending) {
      return;
    }

    try {
      await deleteSimuladoMutation.mutateAsync(simulado.id);
      setConfirmDeleteSimuladoOpen(false);
      navigate('/simulados', { replace: true });
    } catch {
      // Erro tratado via toast no hook.
    }
  }

  const canStart = sortedQuestoes.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1.5">
          <Link to="/simulados">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            <span>Voltar para Simulados</span>
          </Link>
        </Button>

        <Badge variant="secondary">
          {SIMULADO_STATUS_LABELS[simulado.status]}
        </Badge>
      </div>

      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0 space-y-1.5">
          <h1 className="min-w-0 max-w-full break-words text-xl font-bold tracking-tight sm:text-2xl">
            {simulado.titulo}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Anexe o PDF da prova (opcional), cadastre pelo menos uma questão e
            ajuste a duração antes de iniciar o cronômetro.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="default"
            disabled={!canStart || iniciarMutation.isPending}
            onClick={() => setConfirmStartOpen(true)}
            className="w-full gap-2 sm:w-auto"
          >
            {iniciarMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <Play className="h-4 w-4" strokeWidth={1.75} />
            )}
            <span>Iniciar Simulado</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmDeleteSimuladoOpen(true)}
            className="w-full gap-1.5 text-muted-foreground hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 sm:w-auto"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            <span>Excluir</span>
          </Button>
        </div>
      </header>

      {!canStart ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0"
            strokeWidth={1.75}
          />
          <p className="min-w-0 leading-relaxed">
            Cadastre pelo menos <strong>1 questão</strong> abaixo para habilitar
            o botão <strong>Iniciar Simulado</strong>.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-6">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" strokeWidth={1.75} />
              <CardTitle className="text-base">
                Configurações do Simulado
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveMetadata} noValidate className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prep-titulo">Título do simulado</Label>
                <Input
                  id="prep-titulo"
                  maxLength={160}
                  disabled={updateSimuladoMutation.isPending}
                  value={tituloInput}
                  onChange={(event) => {
                    setTituloInput(event.target.value);
                    if (metadataErrors.titulo) {
                      setMetadataErrors((prev) => ({
                        ...prev,
                        titulo: undefined,
                      }));
                    }
                  }}
                />
                {metadataErrors.titulo ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {metadataErrors.titulo}
                  </p>
                ) : null}
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Duração configurada
                  </span>
                  <span className="font-mono text-xs font-semibold text-foreground tabular-nums">
                    {configuredSecondsDraft > 0
                      ? formatConfiguredDuration(configuredSecondsDraft)
                      : '0min'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {SIMULADO_DURATION_PRESETS.map((preset) => {
                    const active =
                      hoursInput === preset.hours &&
                      minutesInput === preset.minutes;
                    return (
                      <Button
                        key={preset.label}
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        disabled={updateSimuladoMutation.isPending}
                        onClick={() => {
                          setHoursInput(preset.hours);
                          setMinutesInput(preset.minutes);
                          setMetadataErrors((prev) => ({
                            ...prev,
                            duration: undefined,
                          }));
                        }}
                        className={cn(
                          'h-8 px-3 font-mono text-xs',
                          !active && 'bg-background'
                        )}
                      >
                        {preset.label}
                      </Button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="prep-horas" className="text-xs">
                      Horas (0 a 24)
                    </Label>
                    <Input
                      id="prep-horas"
                      type="number"
                      min={0}
                      max={24}
                      step={1}
                      disabled={updateSimuladoMutation.isPending}
                      value={Number.isNaN(hoursInput) ? '' : hoursInput}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setHoursInput(raw === '' ? Number.NaN : Number(raw));
                        setMetadataErrors((prev) => ({
                          ...prev,
                          duration: undefined,
                        }));
                      }}
                      className="font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prep-minutos" className="text-xs">
                      Minutos (0 a 59)
                    </Label>
                    <Input
                      id="prep-minutos"
                      type="number"
                      min={0}
                      max={59}
                      step={1}
                      disabled={updateSimuladoMutation.isPending}
                      value={Number.isNaN(minutesInput) ? '' : minutesInput}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setMinutesInput(raw === '' ? Number.NaN : Number(raw));
                        setMetadataErrors((prev) => ({
                          ...prev,
                          duration: undefined,
                        }));
                      }}
                      className="font-mono"
                    />
                  </div>
                </div>

                {metadataErrors.duration ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {metadataErrors.duration}
                  </p>
                ) : null}
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={
                    !isMetadataDirty || updateSimuladoMutation.isPending
                  }
                  className="w-full gap-2 sm:w-auto"
                >
                  {updateSimuladoMutation.isPending ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        strokeWidth={1.75}
                      />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" strokeWidth={1.75} />
                      <span>Salvar configurações</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-6">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" strokeWidth={1.75} />
                <CardTitle className="text-base">
                  Caderno de Prova (PDF)
                </CardTitle>
              </div>
              {simulado.hasPdf ? (
                <Badge variant="success">PDF anexado</Badge>
              ) : (
                <Badge variant="secondary">Opcional</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => void handlePdfFileSelected(event)}
              className="hidden"
            />

            {simulado.hasPdf ? (
              <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Arquivo armazenado com acesso privado
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    O PDF será exibido automaticamente ao lado do painel de
                    pensamentos durante toda a execução da prova.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {localPdfUrl ? (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="gap-1.5"
                    >
                      <a
                        href={localPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink
                          className="h-3.5 w-3.5"
                          strokeWidth={1.75}
                        />
                        <span>Abrir PDF em nova aba</span>
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
                      <RefreshCw
                        className={cn(
                          'h-3.5 w-3.5',
                          refreshPdfMutation.isPending && 'animate-spin'
                        )}
                        strokeWidth={1.75}
                      />
                      <span>Gerar link do PDF</span>
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadPdfMutation.isPending}
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5"
                  >
                    {uploadPdfMutation.isPending ? (
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        strokeWidth={1.75}
                      />
                    ) : (
                      <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
                    )}
                    <span>Substituir PDF</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={deletePdfMutation.isPending}
                    onClick={() => setConfirmRemovePdfOpen(true)}
                    className="gap-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>Remover PDF</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-7 text-center">
                <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
                  <FileUp className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Nenhum PDF anexado
                </p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Envie o caderno de questões em formato <strong>.pdf</strong>{' '}
                  (até 20 MiB) para lê-lo durante a execução.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadPdfMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 gap-2"
                >
                  {uploadPdfMutation.isPending ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        strokeWidth={1.75}
                      />
                      <span>Enviando PDF...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" strokeWidth={1.75} />
                      <span>Anexar PDF da Prova</span>
                    </>
                  )}
                </Button>
              </div>
            )}

            {pdfInlineError ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {pdfInlineError}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" strokeWidth={1.75} />
              <CardTitle className="text-base">
                Questões da Prova ({sortedQuestoes.length})
              </CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              Ordenadas por posição crescente
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <form
            onSubmit={handleAddQuestao}
            noValidate
            className="space-y-3 rounded-xl border border-border bg-muted/30 p-3.5 sm:p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Adicionar nova questão
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="new-questao-numero" className="text-xs">
                  Número / Código
                </Label>
                <Input
                  id="new-questao-numero"
                  ref={numeroInputRef}
                  maxLength={30}
                  disabled={createQuestaoMutation.isPending}
                  value={newNumeroQuestao}
                  onChange={(event) => {
                    setNewNumeroQuestao(event.target.value);
                    if (newQuestaoErrors.numeroQuestao) {
                      setNewQuestaoErrors((prev) => ({
                        ...prev,
                        numeroQuestao: undefined,
                      }));
                    }
                  }}
                  placeholder="Ex.: Q1, A, 138"
                  className="font-mono"
                />
                {newQuestaoErrors.numeroQuestao ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {newQuestaoErrors.numeroQuestao}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5 sm:col-span-6">
                <Label htmlFor="new-questao-titulo" className="text-xs">
                  Título / Identificação
                </Label>
                <Input
                  id="new-questao-titulo"
                  maxLength={200}
                  disabled={createQuestaoMutation.isPending}
                  value={newTituloQuestao}
                  onChange={(event) => {
                    setNewTituloQuestao(event.target.value);
                    if (newQuestaoErrors.tituloQuestao) {
                      setNewQuestaoErrors((prev) => ({
                        ...prev,
                        tituloQuestao: undefined,
                      }));
                    }
                  }}
                  placeholder="Ex.: Árvore Geradora Mínima"
                />
                {newQuestaoErrors.tituloQuestao ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {newQuestaoErrors.tituloQuestao}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="new-questao-ordem" className="text-xs">
                  Ordem (opcional)
                </Label>
                <Input
                  id="new-questao-ordem"
                  type="number"
                  min={0}
                  max={10000}
                  step={1}
                  disabled={createQuestaoMutation.isPending}
                  value={newOrdemInput}
                  onChange={(event) => {
                    setNewOrdemInput(event.target.value);
                    if (newQuestaoErrors.ordem) {
                      setNewQuestaoErrors((prev) => ({
                        ...prev,
                        ordem: undefined,
                      }));
                    }
                  }}
                  placeholder="Auto"
                  className="font-mono"
                />
                {newQuestaoErrors.ordem ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {newQuestaoErrors.ordem}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={createQuestaoMutation.isPending}
                className="w-full gap-1.5 sm:w-auto"
              >
                {createQuestaoMutation.isPending ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      strokeWidth={1.75}
                    />
                    <span>Adicionando...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" strokeWidth={1.75} />
                    <span>Adicionar Questão</span>
                  </>
                )}
              </Button>
            </div>
          </form>

          {sortedQuestoes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Nenhuma questão cadastrada até o momento
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Utilize o formulário acima para adicionar as questões deste
                simulado.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {sortedQuestoes.map((questao) => {
                const isEditingThis = editingQuestaoId === questao.id;

                if (isEditingThis) {
                  return (
                    <li
                      key={questao.id}
                      className="space-y-3 rounded-xl border border-primary/30 bg-muted/40 p-3.5"
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                        <div className="space-y-1 sm:col-span-3">
                          <Label
                            htmlFor={`edit-numero-${questao.id}`}
                            className="text-xs"
                          >
                            Número / Código
                          </Label>
                          <Input
                            id={`edit-numero-${questao.id}`}
                            maxLength={30}
                            disabled={updateQuestaoMutation.isPending}
                            value={editNumeroQuestao}
                            onChange={(event) => {
                              setEditNumeroQuestao(event.target.value);
                              if (editQuestaoErrors.numeroQuestao) {
                                setEditQuestaoErrors((prev) => ({
                                  ...prev,
                                  numeroQuestao: undefined,
                                }));
                              }
                            }}
                            className="font-mono"
                          />
                          {editQuestaoErrors.numeroQuestao ? (
                            <p className="text-xs text-rose-600 dark:text-rose-400">
                              {editQuestaoErrors.numeroQuestao}
                            </p>
                          ) : null}
                        </div>

                        <div className="space-y-1 sm:col-span-6">
                          <Label
                            htmlFor={`edit-titulo-${questao.id}`}
                            className="text-xs"
                          >
                            Título / Identificação
                          </Label>
                          <Input
                            id={`edit-titulo-${questao.id}`}
                            maxLength={200}
                            disabled={updateQuestaoMutation.isPending}
                            value={editTituloQuestao}
                            onChange={(event) => {
                              setEditTituloQuestao(event.target.value);
                              if (editQuestaoErrors.tituloQuestao) {
                                setEditQuestaoErrors((prev) => ({
                                  ...prev,
                                  tituloQuestao: undefined,
                                }));
                              }
                            }}
                          />
                          {editQuestaoErrors.tituloQuestao ? (
                            <p className="text-xs text-rose-600 dark:text-rose-400">
                              {editQuestaoErrors.tituloQuestao}
                            </p>
                          ) : null}
                        </div>

                        <div className="space-y-1 sm:col-span-3">
                          <Label
                            htmlFor={`edit-ordem-${questao.id}`}
                            className="text-xs"
                          >
                            Ordem
                          </Label>
                          <Input
                            id={`edit-ordem-${questao.id}`}
                            type="number"
                            min={0}
                            max={10000}
                            step={1}
                            disabled={updateQuestaoMutation.isPending}
                            value={editOrdemInput}
                            onChange={(event) => {
                              setEditOrdemInput(event.target.value);
                              if (editQuestaoErrors.ordem) {
                                setEditQuestaoErrors((prev) => ({
                                  ...prev,
                                  ordem: undefined,
                                }));
                              }
                            }}
                            className="font-mono"
                          />
                          {editQuestaoErrors.ordem ? (
                            <p className="text-xs text-rose-600 dark:text-rose-400">
                              {editQuestaoErrors.ordem}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={updateQuestaoMutation.isPending}
                          onClick={() => setEditingQuestaoId(null)}
                          className="gap-1.5"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                          <span>Cancelar</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={updateQuestaoMutation.isPending}
                          onClick={() => void handleSaveEditQuestao(questao.id)}
                          className="gap-1.5"
                        >
                          {updateQuestaoMutation.isPending ? (
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
                    </li>
                  );
                }

                return (
                  <li
                    key={questao.id}
                    className="flex flex-col gap-2.5 rounded-xl border border-border bg-background/60 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
                      <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                        Ordem {questao.ordem}
                      </span>
                      <span className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                        {questao.numeroQuestao}
                      </span>
                      <span className="min-w-0 flex-1 break-words text-sm font-medium text-foreground">
                        {questao.tituloQuestao}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditQuestao(questao)}
                        aria-label={`Editar questão ${questao.numeroQuestao}`}
                        title="Editar questão"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingQuestao(questao)}
                        aria-label={`Excluir questão ${questao.numeroQuestao}`}
                        title="Excluir questão"
                        className="h-8 w-8 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmStartOpen}
        onOpenChange={(nextOpen) => {
          if (!iniciarMutation.isPending) {
            setConfirmStartOpen(nextOpen);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar simulado agora?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                <p>
                  O cronômetro de{' '}
                  <strong className="font-semibold text-foreground">
                    {formatConfiguredDuration(
                      simulado.duracaoConfiguradaSegundos
                    )}
                  </strong>{' '}
                  será iniciado em UTC para as{' '}
                  <strong className="font-semibold text-foreground">
                    {sortedQuestoes.length}{' '}
                    {sortedQuestoes.length === 1 ? 'questão' : 'questões'}
                  </strong>{' '}
                  cadastradas. Durante a execução, título, duração, PDF e
                  questões não poderão ser alterados.
                </p>

                {!simulado.hasPdf ? (
                  <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                    Aviso: nenhum PDF está anexado a este simulado. Você ainda
                    pode iniciar a prova e registrar pensamentos normalmente por
                    questão.
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={iniciarMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={iniciarMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmStart();
              }}
            >
              {iniciarMutation.isPending ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Iniciando...</span>
                </>
              ) : (
                <span>Confirmar e iniciar</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmRemovePdfOpen}
        onOpenChange={(nextOpen) => {
          if (!deletePdfMutation.isPending) {
            setConfirmRemovePdfOpen(nextOpen);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover PDF do simulado</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo PDF anexado será excluído permanentemente do
              armazenamento privado deste simulado. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePdfMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePdfMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmRemovePdf();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePdfMutation.isPending ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Removendo...</span>
                </>
              ) : (
                <span>Remover PDF</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deletingQuestao)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteQuestaoMutation.isPending) {
            setDeletingQuestao(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir questão do simulado</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover a questão{' '}
              <strong className="font-semibold text-foreground">
                {deletingQuestao?.numeroQuestao} —{' '}
                {deletingQuestao?.tituloQuestao}
              </strong>{' '}
              da preparação deste simulado?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteQuestaoMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteQuestaoMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDeleteQuestao();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteQuestaoMutation.isPending ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Excluindo...</span>
                </>
              ) : (
                <span>Excluir questão</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDeleteSimuladoOpen}
        onOpenChange={(nextOpen) => {
          if (!deleteSimuladoMutation.isPending) {
            setConfirmDeleteSimuladoOpen(nextOpen);
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
              ? Esta ação remove o simulado, suas questões e o PDF anexado.
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
                void handleConfirmDeleteSimulado();
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
