import { memo } from 'react';
import { ExternalLink, FileText, FileX, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SimuladoPdfViewerProps {
  hasPdf: boolean;
  pdfUrl: string | null;
  simuladoTitulo: string;
  isRefreshing: boolean;
  onRefreshPdf: () => void;
}

export const SimuladoPdfViewer = memo(function SimuladoPdfViewer({
  hasPdf,
  pdfUrl,
  simuladoTitulo,
  isRefreshing,
  onRefreshPdf,
}: SimuladoPdfViewerProps) {
  return (
    <section
      aria-label="Visualizador do caderno de prova em PDF"
      className="flex min-h-[65vh] flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card lg:min-h-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <FileText
            className="h-4 w-4 shrink-0 text-primary"
            strokeWidth={1.75}
          />
          <span className="truncate text-xs font-semibold text-foreground sm:text-sm">
            Caderno de Prova (PDF)
          </span>
        </div>

        <div className="flex max-w-full flex-wrap items-center gap-2">
          {hasPdf ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              onClick={onRefreshPdf}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  isRefreshing && 'animate-spin'
                )}
                strokeWidth={1.75}
              />
              <span>Renovar link PDF</span>
            </Button>
          ) : null}

          {hasPdf && pdfUrl ? (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 gap-1.5 text-xs"
            >
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink
                  className="h-3.5 w-3.5 shrink-0"
                  strokeWidth={1.75}
                />
                <span>Abrir em nova aba</span>
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {!hasPdf ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
            <FileX className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <h2 className="text-sm font-semibold text-foreground">
            Nenhum PDF anexado a este simulado
          </h2>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            Você pode continuar a execução normalmente e registrar seus
            pensamentos para cada questão no painel ao lado.
          </p>
        </div>
      ) : !pdfUrl ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
            <FileText className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <h2 className="text-sm font-semibold text-foreground">
            Link temporário do PDF indisponível
          </h2>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            Solicite uma nova URL assinada para recarregar o documento sem
            perder seu progresso na prova.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            onClick={onRefreshPdf}
            className="mt-4 gap-2"
          >
            <RefreshCw
              className={cn(
                'h-3.5 w-3.5',
                isRefreshing && 'animate-spin'
              )}
              strokeWidth={1.75}
            />
            <span>Carregar link do PDF</span>
          </Button>
        </div>
      ) : (
        <iframe
          title={`Caderno de prova — ${simuladoTitulo}`}
          src={pdfUrl}
          className="h-full min-h-[65vh] w-full flex-1 border-0 bg-muted/20 lg:min-h-0"
        />
      )}
    </section>
  );
});

SimuladoPdfViewer.displayName = 'SimuladoPdfViewer';
