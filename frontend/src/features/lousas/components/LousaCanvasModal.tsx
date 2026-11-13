import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  LOUSA_MAX_TOTAL_SIZE_BYTES,
  type LousaDto,
} from '@shared/types/lousas.types';
import {
  AlertTriangle,
  Grid3X3,
  Loader2,
  PenTool,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
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
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { lousasApi } from '@/features/lousas/api/lousasApi';
import type {
  LousaExcalidrawCanvasHandle,
  LousaLiveStatus,
} from '@/features/lousas/components/LousaExcalidrawCanvas';
import {
  useCreateLousaMutation,
  useUpdateLousaMutation,
} from '@/features/lousas/hooks/useLousas';
import {
  calculateLousaTotalBytes,
  formatBytesLabel,
  isWithinLousaBudget,
  parseValidatedLousaScene,
  type ValidatedLousaScene,
} from '@/features/lousas/utils/lousaBudget';
import { getErrorMessage } from '@/lib/errorMessages';
import { cn } from '@/lib/utils';

const LazyLousaExcalidrawCanvas = lazy(() =>
  import('@/features/lousas/components/LousaExcalidrawCanvas').then((mod) => ({
    default: mod.LousaExcalidrawCanvas,
  }))
);

export interface LousaCanvasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lousaId?: string | null;
  title?: string;
  onSaved: (savedLousa: LousaDto) => void;
}

function CanvasEditorSkeleton() {
  return (
    <div className="flex h-full w-full flex-col gap-3 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-9 w-52 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <Skeleton className="h-full w-full flex-1 rounded-xl" />
    </div>
  );
}

export function LousaCanvasModal({
  open,
  onOpenChange,
  lousaId = null,
  title,
  onSaved,
}: LousaCanvasModalProps) {
  const isEditing = Boolean(lousaId);
  const canvasRef = useRef<LousaExcalidrawCanvasHandle | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const createMutation = useCreateLousaMutation();
  const updateMutation = useUpdateLousaMutation();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const [isLoadingScene, setIsLoadingScene] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedScene, setLoadedScene] = useState<ValidatedLousaScene | null>(
    null
  );
  const [isReadyForCanvas, setIsReadyForCanvas] = useState(false);
  const [gridModeEnabled, setGridModeEnabled] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null
  );
  const [liveStatus, setLiveStatus] = useState<LousaLiveStatus>({
    sceneBytes: 0,
    nonDeletedCount: 0,
    hasUnsavedChanges: false,
  });

  const hydrateExistingScene = useCallback(
    async (targetId: string, signal?: AbortSignal) => {
      setIsLoadingScene(true);
      setLoadError(null);
      setIsReadyForCanvas(false);

      try {
        const dto = await lousasApi.getLousaById(targetId, signal);
        if (!dto.sceneSignedUrl) {
          throw new Error('URL assinada da lousa indisponível.');
        }

        const response = await fetch(dto.sceneSignedUrl, { signal });
        if (!response.ok) {
          throw new Error('Não foi possível baixar os dados da lousa.');
        }

        const rawJson: unknown = await response.json();
        const validated = parseValidatedLousaScene(rawJson);

        if (signal?.aborted) {
          return;
        }

        setLoadedScene(validated);
        setIsReadyForCanvas(true);
      } catch (error) {
        if (signal?.aborted) {
          return;
        }
        setLoadError(getErrorMessage(error));
      } finally {
        if (!signal?.aborted) {
          setIsLoadingScene(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!open) {
      setLoadedScene(null);
      setIsReadyForCanvas(false);
      setLoadError(null);
      setValidationMessage(null);
      setDiscardDialogOpen(false);
      setLiveStatus({
        sceneBytes: 0,
        nonDeletedCount: 0,
        hasUnsavedChanges: false,
      });
      return;
    }

    if (!lousaId) {
      setLoadedScene(null);
      setLoadError(null);
      setIsLoadingScene(false);
      setIsReadyForCanvas(true);
      return;
    }

    const controller = new AbortController();
    void hydrateExistingScene(lousaId, controller.signal);
    return () => controller.abort();
  }, [open, lousaId, hydrateExistingScene]);

  const handleStatusChange = useCallback((nextStatus: LousaLiveStatus) => {
    setLiveStatus(nextStatus);
    if (nextStatus.nonDeletedCount > 0) {
      setValidationMessage((prev) =>
        prev?.includes('elemento') ? null : prev
      );
    }
    if (nextStatus.sceneBytes <= LOUSA_MAX_TOTAL_SIZE_BYTES) {
      setValidationMessage((prev) =>
        prev?.includes('3 MiB') ? null : prev
      );
    }
  }, []);

  const handleRequestClose = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen || isSaving) {
        return;
      }

      if (liveStatus.hasUnsavedChanges) {
        setDiscardDialogOpen(true);
        return;
      }

      onOpenChange(false);
    },
    [isSaving, liveStatus.hasUnsavedChanges, onOpenChange]
  );

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || discardDialogOpen) {
        return;
      }

      const hasExcalidrawOverlay = Boolean(
        document.querySelector(
          '.excalidraw-modal-container .Modal, .excalidraw .context-menu, .excalidraw .Modal'
        )
      );
      if (hasExcalidrawOverlay) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      handleRequestClose(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, discardDialogOpen, handleRequestClose]);

  const handleConfirmDiscard = useCallback(() => {
    setDiscardDialogOpen(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSave = useCallback(async () => {
    if (!canvasRef.current || isSaving) {
      return;
    }

    setValidationMessage(null);

    try {
      const payload = await canvasRef.current.exportPayload();
      const totalBytes = calculateLousaTotalBytes(
        payload.sceneJson,
        payload.previewBlob.size
      );

      if (!isWithinLousaBudget(totalBytes, LOUSA_MAX_TOTAL_SIZE_BYTES)) {
        const message = `A lousa atingiu ${formatBytesLabel(totalBytes)} e ultrapassou o limite de ${formatBytesLabel(LOUSA_MAX_TOTAL_SIZE_BYTES)} (cena + preview). Remova ou reduza imagens antes de salvar.`;
        setValidationMessage(message);
        toast.error(message);
        return;
      }

      const savedLousa = lousaId
        ? await updateMutation.mutateAsync({ id: lousaId, payload })
        : await createMutation.mutateAsync(payload);

      onSaved(savedLousa);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'EmptyLousaCanvasError') {
        setValidationMessage(error.message);
        toast.warning(error.message);
        return;
      }
      if (error instanceof Error && error.message && !('code' in error)) {
        setValidationMessage(error.message);
      }
    }
  }, [
    createMutation,
    isSaving,
    lousaId,
    onOpenChange,
    onSaved,
    updateMutation,
  ]);

  const isNearBudget =
    liveStatus.sceneBytes >= LOUSA_MAX_TOTAL_SIZE_BYTES * 0.85;
  const isOverSceneBudget =
    liveStatus.sceneBytes > LOUSA_MAX_TOTAL_SIZE_BYTES;

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return (
    <>
      {createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          className="fixed inset-0 z-[70] flex flex-col bg-background"
        >
          <header className="shrink-0 border-b border-border bg-card px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5 text-left">
                  <h2
                    id={titleId}
                    className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground"
                  >
                    <PenTool
                      className="h-4 w-4 shrink-0 text-primary"
                      strokeWidth={1.75}
                    />
                    <span className="truncate">
                      {title ?? (isEditing ? 'Editar Lousa' : 'Nova Lousa')}
                    </span>
                  </h2>
                  <p id={descriptionId} className="text-xs text-muted-foreground">
                    Esboce raciocínios, diagramas e rascunhos. Imagens raster são
                    otimizadas automaticamente.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isSaving}
                  onClick={() => handleRequestClose(false)}
                  aria-label="Fechar lousa"
                  title="Fechar lousa"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground sm:hidden"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    isOverSceneBudget
                      ? 'destructive'
                      : isNearBudget
                        ? 'warning'
                        : 'secondary'
                  }
                  className="shrink-0 whitespace-nowrap tabular-nums"
                >
                  {formatBytesLabel(liveStatus.sceneBytes)} /{' '}
                  {formatBytesLabel(LOUSA_MAX_TOTAL_SIZE_BYTES)}
                </Badge>

                <Button
                  type="button"
                  variant={gridModeEnabled ? 'secondary' : 'outline'}
                  size="sm"
                  aria-pressed={gridModeEnabled}
                  onClick={() => setGridModeEnabled((prev) => !prev)}
                  disabled={!isReadyForCanvas || isSaving}
                  className="gap-1.5"
                >
                  <Grid3X3 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>{gridModeEnabled ? 'Grade ativa' : 'Grade'}</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={
                    !isReadyForCanvas || isSaving || isOverSceneBudget
                  }
                  className="gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        strokeWidth={1.75}
                      />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" strokeWidth={1.75} />
                      <span>Salvar lousa</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isSaving}
                  onClick={() => handleRequestClose(false)}
                  aria-label="Fechar lousa"
                  title="Fechar lousa"
                  className="hidden h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground sm:inline-flex"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </div>
            </div>

            {validationMessage || isOverSceneBudget ? (
              <div
                role="alert"
                className={cn(
                  'mt-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed',
                  'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                )}
              >
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  strokeWidth={1.75}
                />
                <span>
                  {validationMessage ??
                    `A cena excedeu o teto de ${formatBytesLabel(LOUSA_MAX_TOTAL_SIZE_BYTES)}. Remova ou reduza elementos antes de salvar.`}
                </span>
              </div>
            ) : null}
          </header>

          <div className="relative min-h-0 flex-1 bg-background">
            {isLoadingScene ? (
              <CanvasEditorSkeleton />
            ) : loadError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="flex items-center gap-2 text-sm font-medium text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span>{loadError}</span>
                </div>
                {lousaId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void hydrateExistingScene(lousaId)}
                    className="gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>Tentar carregar novamente</span>
                  </Button>
                ) : null}
              </div>
            ) : isReadyForCanvas ? (
              <Suspense fallback={<CanvasEditorSkeleton />}>
                <LazyLousaExcalidrawCanvas
                  ref={canvasRef}
                  initialScene={loadedScene}
                  gridModeEnabled={gridModeEnabled}
                  onStatusChange={handleStatusChange}
                />
              </Suspense>
            ) : (
              <CanvasEditorSkeleton />
            )}
          </div>
        </div>,
        document.body
      )}

      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent overlayClassName="z-[85]" className="z-[90]">
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações na lousa?</AlertDialogTitle>
            <AlertDialogDescription>
              Existem desenhos ou alterações ainda não salvos na lousa. Se
              fechar agora, essas edições serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar desenhando</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={handleConfirmDiscard}
            >
              Descartar alterações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
