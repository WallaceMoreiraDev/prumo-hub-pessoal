import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UuidSchema } from '@shared/schemas/common.schema';
import { FinalizarSimuladoSchema } from '@shared/schemas/simulados.schema';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquareText,
  Moon,
  RefreshCw,
  Sun,
} from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '@/components/theme/ThemeProvider';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { simuladosApi } from '@/features/simulados/api/simuladosApi';
import { SimuladoPdfViewer } from '@/features/simulados/components/SimuladoPdfViewer';
import { SimuladoPensamentosPanel } from '@/features/simulados/components/SimuladoPensamentosPanel';
import { SimuladoTimer } from '@/features/simulados/components/SimuladoTimer';
import {
  useFinalizarSimuladoMutation,
  useRefreshSimuladoPdfUrlMutation,
  useSimuladoDetailQuery,
} from '@/features/simulados/hooks/useSimulados';
import {
  calculateSimuladoTimerSnapshot,
  formatClockDuration,
  resolveTimerConfig,
} from '@/features/simulados/utils/simulados';
import { getErrorMessage } from '@/lib/errorMessages';
import { cn } from '@/lib/utils';

type MobileExecutionPane = 'PDF' | 'PENSAMENTOS';

const PREVENTIVE_PDF_RENEWAL_INTERVAL_MS = 50 * 60 * 1000;

function SimuladoExecucaoSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/85 px-3 py-2.5 backdrop-blur-md sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2.5 lg:flex lg:items-center lg:justify-between lg:gap-4">
          <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 lg:order-1 lg:flex-1 lg:gap-3">
            <Skeleton className="h-9 w-10 shrink-0 rounded-xl sm:w-24" />
            <Skeleton className="h-5 w-48 max-w-full flex-1 lg:flex-none" />
          </div>
          <Skeleton className="col-start-2 row-start-1 h-9 w-9 shrink-0 justify-self-end rounded-xl lg:order-2" />
          <div className="col-span-2 row-start-2 flex flex-wrap items-center justify-between gap-2 lg:order-3 lg:w-auto lg:shrink-0 lg:flex-nowrap lg:justify-end">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-36 rounded-xl" />
          </div>
        </div>
      </header>
      <div className="grid flex-1 grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-12">
        <Skeleton className="h-[65vh] rounded-2xl lg:col-span-7 lg:h-full xl:col-span-8" />
        <Skeleton className="h-[50vh] rounded-2xl lg:col-span-5 lg:h-full xl:col-span-4" />
      </div>
    </div>
  );
}

export function SimuladoExecucaoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const parsedIdResult = useMemo(
    () => UuidSchema.safeParse(id ?? ''),
    [id]
  );
  const validId = parsedIdResult.success ? parsedIdResult.data : '';

  const detailQuery = useSimuladoDetailQuery(validId, Boolean(validId));
  const finalizarMutation = useFinalizarSimuladoMutation();
  const refreshPdfMutation = useRefreshSimuladoPdfUrlMutation();
  const { mutateAsync: refreshPdfUrlAsync } = refreshPdfMutation;

  const detalhe = detailQuery.data;

  // URL estabilizada do PDF: atualizada apenas na carga inicial, troca de storage path,
  // botão manual ou renovação preventiva — nunca em mutações de pensamentos.
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);
  const lastPdfSyncRef = useRef<{
    simuladoId: string;
    storagePath: string | null;
  } | null>(null);

  useEffect(() => {
    if (!detalhe) {
      return;
    }

    const prevSync = lastPdfSyncRef.current;
    const shouldSyncInitialUrl =
      !prevSync ||
      prevSync.simuladoId !== detalhe.id ||
      prevSync.storagePath !== detalhe.pdfStoragePath;

    if (shouldSyncInitialUrl) {
      lastPdfSyncRef.current = {
        simuladoId: detalhe.id,
        storagePath: detalhe.pdfStoragePath,
      };
      setActivePdfUrl(detalhe.pdfSignedUrl);
    }
  }, [detalhe]);

  const handleRefreshPdf = useCallback(async () => {
    if (!validId) {
      return;
    }

    try {
      const response = await refreshPdfUrlAsync(validId);
      setActivePdfUrl(response.signedUrl);
      toast.success('Link do PDF renovado.');
    } catch {
      // Erro notificado via toast no hook.
    }
  }, [refreshPdfUrlAsync, validId]);

  const handleRefreshPdfClick = useCallback(() => {
    void handleRefreshPdf();
  }, [handleRefreshPdf]);

  const hasPdfActiveInRun =
    detalhe?.status === 'EM_ANDAMENTO' && Boolean(detalhe.hasPdf);

  useEffect(() => {
    if (!hasPdfActiveInRun || !validId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void simuladosApi
        .getSimuladoPdfUrl(validId)
        .then((res) => {
          setActivePdfUrl(res.signedUrl);
        })
        .catch(() => {
          // Renovação preventiva silenciosa; usuário dispõe do botão manual caso expire.
        });
    }, PREVENTIVE_PDF_RENEWAL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasPdfActiveInRun, validId]);

  const [mobilePane, setMobilePane] = useState<MobileExecutionPane>('PDF');
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [previewElapsedSeconds, setPreviewElapsedSeconds] = useState(0);

  const totalPensamentos = useMemo(() => {
    if (!detalhe) {
      return 0;
    }
    return detalhe.questoes.reduce((acc, q) => acc + q.pensamentos.length, 0);
  }, [detalhe]);

  function openFinishDialog(): void {
    if (!detalhe) {
      return;
    }
    const timerConfig = resolveTimerConfig({
      simuladoId: detalhe.id,
      startedAt: detalhe.startedAt,
      duracaoConfiguradaSegundos: detalhe.duracaoConfiguradaSegundos,
    });
    const snapshot = calculateSimuladoTimerSnapshot({
      startedAt: timerConfig.startedAt,
      duracaoConfiguradaSegundos: timerConfig.duracaoConfiguradaSegundos,
      nowMs: Date.now(),
    });
    setPreviewElapsedSeconds(snapshot.elapsedSeconds);
    setFinishDialogOpen(true);
  }

  async function handleConfirmFinalizar(): Promise<void> {
    if (!detalhe || finalizarMutation.isPending) {
      return;
    }

    const timerConfig = resolveTimerConfig({
      simuladoId: detalhe.id,
      startedAt: detalhe.startedAt,
      duracaoConfiguradaSegundos: detalhe.duracaoConfiguradaSegundos,
    });
    const snapshot = calculateSimuladoTimerSnapshot({
      startedAt: timerConfig.startedAt,
      duracaoConfiguradaSegundos: timerConfig.duracaoConfiguradaSegundos,
      nowMs: Date.now(),
    });
    const tempoGastoSegundos = Math.min(
      864_000,
      Math.max(0, snapshot.elapsedSeconds)
    );

    const parsed = FinalizarSimuladoSchema.safeParse({ tempoGastoSegundos });
    if (!parsed.success) {
      toast.error('Tempo gasto inválido para finalizar o simulado.');
      return;
    }

    try {
      await finalizarMutation.mutateAsync({
        id: detalhe.id,
        input: parsed.data,
      });
      setFinishDialogOpen(false);
      navigate(`/simulados/${detalhe.id}`, { replace: true });
    } catch {
      // Erro tratado via toast no hook.
    }
  }

  if (!parsedIdResult.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            Identificador de simulado inválido
          </h1>
          <p className="text-sm text-muted-foreground">
            O endereço informado não corresponde a um simulado válido.
          </p>
          <Button asChild className="w-full">
            <Link to="/simulados">Voltar para Simulados</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (detailQuery.isPending) {
    return <SimuladoExecucaoSkeleton />;
  }

  if (detailQuery.isError || !detalhe) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg space-y-4 rounded-2xl border border-rose-500/25 bg-card p-6">
          <div className="flex items-start gap-3 text-rose-600 dark:text-rose-400">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
            <div className="min-w-0 space-y-1">
              <h1 className="text-base font-semibold text-foreground">
                Não foi possível carregar a execução do simulado
              </h1>
              <p className="text-sm text-muted-foreground">
                {getErrorMessage(detailQuery.error)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" asChild>
              <Link to="/simulados">Voltar para Simulados</Link>
            </Button>
            <Button
              type="button"
              onClick={() => void detailQuery.refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
              <span>Tentar novamente</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (detalhe.status !== 'EM_ANDAMENTO') {
    return <Navigate to={`/simulados/${detalhe.id}`} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:h-screen lg:overflow-hidden">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 px-3 py-2.5 backdrop-blur-md sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2.5 lg:flex lg:items-center lg:justify-between lg:gap-4">
          <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 lg:order-1 lg:flex-1 lg:gap-3">
            <Button
              variant="outline"
              size="sm"
              asChild
              title="Voltar para a listagem sem finalizar ou pausar o cronômetro"
              className="h-9 shrink-0 gap-1.5 px-2.5 sm:px-3"
            >
              <Link to="/simulados">
                <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
                <span className="hidden sm:inline">Simulados</span>
              </Link>
            </Button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold tracking-tight sm:text-base">
                {detalhe.titulo}
              </h1>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                Execução em andamento — sair desta tela não pausa o cronômetro
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={
              theme === 'dark'
                ? 'Alternar para modo claro'
                : 'Alternar para modo escuro'
            }
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            className="col-start-2 row-start-1 h-9 w-9 shrink-0 justify-self-end lg:order-2"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <Moon className="h-4 w-4" strokeWidth={1.75} />
            )}
          </Button>

          <div className="col-span-2 row-start-2 flex flex-wrap items-center justify-between gap-2 lg:order-3 lg:w-auto lg:shrink-0 lg:flex-nowrap lg:justify-end">
            <SimuladoTimer
              simuladoId={detalhe.id}
              startedAt={detalhe.startedAt}
              duracaoConfiguradaSegundos={detalhe.duracaoConfiguradaSegundos}
            />

            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={finalizarMutation.isPending}
              onClick={openFinishDialog}
              className="h-9 min-w-0 gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span>Finalizar Simulado</span>
            </Button>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 lg:hidden">
          <button
            type="button"
            onClick={() => setMobilePane('PDF')}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              mobilePane === 'PDF'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span>Prova (PDF)</span>
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('PENSAMENTOS')}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              mobilePane === 'PENSAMENTOS'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MessageSquareText
              className="h-3.5 w-3.5 shrink-0"
              strokeWidth={1.75}
            />
            <span className="tabular-nums">
              Pensamentos ({totalPensamentos})
            </span>
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-12">
        <div
          className={cn(
            'min-h-0 flex-col lg:col-span-7 lg:flex xl:col-span-8',
            mobilePane === 'PDF' ? 'flex' : 'hidden'
          )}
        >
          <SimuladoPdfViewer
            hasPdf={detalhe.hasPdf}
            pdfUrl={activePdfUrl}
            simuladoTitulo={detalhe.titulo}
            isRefreshing={refreshPdfMutation.isPending}
            onRefreshPdf={handleRefreshPdfClick}
          />
        </div>

        <div
          className={cn(
            'min-h-0 flex-col lg:col-span-5 lg:flex xl:col-span-4',
            mobilePane === 'PENSAMENTOS' ? 'flex' : 'hidden'
          )}
        >
          <SimuladoPensamentosPanel
            simuladoId={detalhe.id}
            startedAt={detalhe.startedAt}
            duracaoConfiguradaSegundos={detalhe.duracaoConfiguradaSegundos}
            questoes={detalhe.questoes}
          />
        </div>
      </main>

      <AlertDialog
        open={finishDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!finalizarMutation.isPending) {
            setFinishDialogOpen(nextOpen);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar simulado agora?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Ao finalizar, o simulado será encerrado com tempo decorrido de{' '}
                  <strong className="font-mono font-semibold text-foreground">
                    {formatClockDuration(previewElapsedSeconds)}
                  </strong>{' '}
                  e abrirá a tela de classificação pós-prova.
                </p>
                <p>
                  Não será mais possível registrar novos pensamentos, mas você
                  ainda poderá editar ou excluir pensamentos existentes e
                  classificar cada questão entre Acertei, Parcial e Errei.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizarMutation.isPending}>
              Continuar prova
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={finalizarMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmFinalizar();
              }}
            >
              {finalizarMutation.isPending ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Finalizando...</span>
                </>
              ) : (
                <span>Confirmar e finalizar</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
