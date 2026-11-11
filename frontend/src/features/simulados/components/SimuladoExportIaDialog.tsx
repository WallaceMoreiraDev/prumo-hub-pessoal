import { useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  FileCode2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useSimuladoExportIaQuery } from '@/features/simulados/hooks/useSimulados';
import { buildMarkdownDownloadFilename } from '@/features/simulados/utils/simulados';
import { getErrorMessage } from '@/lib/errorMessages';

export interface SimuladoExportIaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  simuladoId: string;
  simuladoTitulo: string;
}

export function SimuladoExportIaDialog({
  open,
  onOpenChange,
  simuladoId,
  simuladoTitulo,
}: SimuladoExportIaDialogProps) {
  const exportQuery = useSimuladoExportIaQuery(simuladoId, open);
  const [copiedRecently, setCopiedRecently] = useState(false);

  const markdown = exportQuery.data?.markdown ?? '';
  const resolvedTitle = exportQuery.data?.titulo ?? simuladoTitulo;

  async function handleCopy(): Promise<void> {
    if (!markdown) {
      return;
    }

    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedRecently(true);
      toast.success('Resumo em Markdown copiado para a área de transferência.');
      window.setTimeout(() => {
        setCopiedRecently(false);
      }, 2000);
    } catch {
      toast.error(
        'Não foi possível copiar automaticamente. Utilize o download do arquivo .md ou selecione o texto manualmente.'
      );
    }
  }

  function handleDownload(): void {
    if (!markdown) {
      return;
    }

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = buildMarkdownDownloadFilename(resolvedTitle);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Arquivo Markdown baixado.');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode2
              className="h-5 w-5 shrink-0 text-primary"
              strokeWidth={1.75}
            />
            <span className="min-w-0 truncate">Exportar para IA</span>
          </DialogTitle>
          <DialogDescription>
            Resumo estruturado em Markdown com resultado das questões, temas
            vinculados, cronologia de pensamentos e observações pós-revisão.
          </DialogDescription>
        </DialogHeader>

        {exportQuery.isPending ? (
          <div className="space-y-3 py-2" aria-busy="true">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : exportQuery.isError ? (
          <div className="flex flex-col gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2.5 text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                strokeWidth={1.75}
              />
              <p className="min-w-0 break-words leading-relaxed">
                {getErrorMessage(exportQuery.error)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void exportQuery.refetch()}
              className="shrink-0 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Tentar novamente</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopy()}
                className="gap-1.5"
              >
                {copiedRecently ? (
                  <>
                    <Check
                      className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                      strokeWidth={2}
                    />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>Copiar Markdown</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleDownload}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Baixar .md</span>
              </Button>
            </div>

            <pre className="max-h-[52vh] overflow-auto rounded-xl border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground">
              {markdown}
            </pre>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
