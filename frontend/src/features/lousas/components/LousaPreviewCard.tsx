import { useCallback, useEffect, useRef, useState } from 'react';
import type { LousaDto, LousaSummaryDto } from '@shared/types/lousas.types';
import {
  ImageOff,
  Maximize2,
  Pencil,
  PenTool,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { lousasApi } from '@/features/lousas/api/lousasApi';
import { LousaCanvasModal } from '@/features/lousas/components/LousaCanvasModal';
import { formatBytesLabel } from '@/features/lousas/utils/lousaBudget';
import { cn } from '@/lib/utils';

export interface LousaPreviewCardProps {
  lousa: LousaSummaryDto;
  title?: string;
  compact?: boolean;
  onEditClick?: () => void;
  onEdited?: (savedLousa: LousaDto) => void;
  className?: string;
}

export function LousaPreviewCard({
  lousa,
  title = 'Lousa vinculada',
  compact = false,
  onEditClick,
  onEdited,
  className,
}: LousaPreviewCardProps) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(
    lousa.previewSignedUrl
  );
  const [hasError, setHasError] = useState(!lousa.previewSignedUrl);
  const [isRefreshingUrl, setIsRefreshingUrl] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [internalEditOpen, setInternalEditOpen] = useState(false);
  const retriedOnceRef = useRef(false);

  const refreshSignedUrl = useCallback(async () => {
    setIsRefreshingUrl(true);
    try {
      const urls = await lousasApi.getLousaUrls(lousa.id);
      setPreviewSrc(urls.previewSignedUrl);
      setHasError(!urls.previewSignedUrl);
    } catch {
      setHasError(true);
    } finally {
      setIsRefreshingUrl(false);
    }
  }, [lousa.id]);

  useEffect(() => {
    setPreviewSrc(lousa.previewSignedUrl);
    retriedOnceRef.current = false;
    if (!lousa.previewSignedUrl) {
      setHasError(false);
      retriedOnceRef.current = true;
      void refreshSignedUrl();
      return;
    }
    setHasError(false);
  }, [lousa.id, lousa.previewSignedUrl, lousa.updatedAt, refreshSignedUrl]);

  const handleImageError = useCallback(() => {
    if (retriedOnceRef.current) {
      setHasError(true);
      return;
    }

    retriedOnceRef.current = true;
    void refreshSignedUrl();
  }, [refreshSignedUrl]);

  function handleOpenEditor(): void {
    setZoomOpen(false);
    if (onEditClick) {
      if (zoomOpen) {
        window.requestAnimationFrame(() => onEditClick());
      } else {
        onEditClick();
      }
      return;
    }

    if (zoomOpen) {
      window.requestAnimationFrame(() => setInternalEditOpen(true));
    } else {
      setInternalEditOpen(true);
    }
  }

  function handleCanvasSaved(saved: LousaDto): void {
    setPreviewSrc(saved.previewSignedUrl);
    setHasError(false);
    retriedOnceRef.current = false;
    onEdited?.(saved);
  }

  return (
    <>
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-border bg-muted/20',
          className
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-card/70 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <PenTool
              className="h-3.5 w-3.5 shrink-0 text-primary"
              strokeWidth={1.75}
            />
            <span className="truncate text-xs font-medium text-foreground">
              {title}
            </span>
            <Badge
              variant="secondary"
              className="shrink-0 whitespace-nowrap tabular-nums text-[11px]"
            >
              {formatBytesLabel(lousa.totalSizeBytes)}
            </Badge>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {!hasError ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setZoomOpen(true)}
                aria-label="Ampliar lousa"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Ampliar</span>
              </Button>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleOpenEditor}
              aria-label="Editar na lousa"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Editar na lousa</span>
            </Button>
          </div>
        </div>

        <div className="bg-background/60 p-2">
          {hasError || !previewSrc ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-6 text-center">
              <ImageOff
                className="h-5 w-5 text-muted-foreground"
                strokeWidth={1.75}
              />
              <p className="text-xs text-muted-foreground">
                Não foi possível carregar o preview da lousa.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRefreshingUrl}
                onClick={() => {
                  retriedOnceRef.current = true;
                  void refreshSignedUrl();
                }}
                className="gap-1.5"
              >
                <RefreshCw
                  className={cn(
                    'h-3.5 w-3.5',
                    isRefreshingUrl && 'animate-spin'
                  )}
                  strokeWidth={1.75}
                />
                <span>Recarregar preview</span>
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              title="Clique para ampliar a lousa"
              className="group relative block w-full overflow-hidden rounded-lg border border-border/60 bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img
                src={previewSrc}
                alt={title}
                loading="lazy"
                onError={handleImageError}
                className={cn(
                  'mx-auto w-full object-contain transition-transform duration-200 group-hover:scale-[1.01]',
                  compact ? 'max-h-44' : 'max-h-72'
                )}
              />
            </button>
          )}
        </div>
      </div>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <PenTool
                className="h-4 w-4 shrink-0 text-primary"
                strokeWidth={1.75}
              />
              <span>{title}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Visualização estática da lousa ({formatBytesLabel(lousa.totalSizeBytes)}).
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-hidden rounded-xl border border-border bg-muted/20 p-2">
            {previewSrc && !hasError ? (
              <img
                src={previewSrc}
                alt={title}
                onError={handleImageError}
                className="mx-auto max-h-[68vh] w-full rounded-lg object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <ImageOff
                  className="h-5 w-5 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <p className="text-xs text-muted-foreground">
                  Preview da lousa indisponível no momento.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setZoomOpen(false)}
            >
              Fechar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleOpenEditor}
              className="gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Editar na lousa</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!onEditClick ? (
        <LousaCanvasModal
          open={internalEditOpen && !zoomOpen}
          onOpenChange={setInternalEditOpen}
          lousaId={lousa.id}
          title="Editar Lousa"
          onSaved={handleCanvasSaved}
        />
      ) : null}
    </>
  );
}
