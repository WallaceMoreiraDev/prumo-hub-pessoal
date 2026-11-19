import { useState } from 'react';
import type { EstudosResumoQuery } from '@shared/schemas/exercicios.schema';
import {
  AlertCircle,
  Bot,
  Check,
  Copy,
  Download,
  Printer,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { MarkdownMathRenderer } from '@/components/markdown/MarkdownMathRenderer';
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
import { useEstudoExportIaQuery } from '@/features/exercicios/hooks/useExercicios';
import { getErrorMessage } from '@/lib/errorMessages';

export interface EstudoExportIaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: EstudosResumoQuery;
}

export function EstudoExportIaDialog({
  open,
  onOpenChange,
  query,
}: EstudoExportIaDialogProps) {
  const [copied, setCopied] = useState(false);
  const { data, isLoading, isError, error, refetch } = useEstudoExportIaQuery(
    query,
    open
  );

  async function handleCopy(): Promise<void> {
    if (!data?.markdown) {
      return;
    }

    try {
      await navigator.clipboard.writeText(data.markdown);
      setCopied(true);
      toast.success('Relatório em Markdown copiado para a área de transferência.');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Não foi possível copiar o conteúdo automaticamente.');
    }
  }

  function handleDownload(): void {
    if (!data?.markdown) {
      return;
    }

    try {
      const blob = new Blob([data.markdown], {
        type: 'text/markdown;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `estudos-prumo-${query.periodo}-${new Date().toISOString().slice(0, 10)}.md`;

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Arquivo ${filename} baixado com sucesso.`);
    } catch {
      toast.error('Erro ao gerar o arquivo de download.');
    }
  }

  function handlePrint(): void {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto print:m-0 print:max-h-none print:max-w-none print:border-none print:p-0 print:shadow-none"
        data-testid="estudo-export-ia-dialog"
      >
        <DialogHeader className="space-y-1 print:hidden">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" strokeWidth={1.75} />
            <DialogTitle className="text-lg font-bold tracking-tight">
              Exportação Estruturada para Inteligência Artificial
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {data?.periodoLabel
              ? `Relatório consolidado: ${data.periodoLabel}. Pronto para envio a LLMs, Claude, ChatGPT ou análise técnica de desempenho.`
              : 'Gere um relatório pronto em Markdown com as sessões de estudo, distribuição de foco por tema e desfechos.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 py-2">
          {isLoading ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-semibold text-foreground">
                Falha ao gerar relatório de exportação
              </p>
              <p className="text-xs text-muted-foreground">
                {getErrorMessage(error)}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : data?.markdown ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 print:hidden">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Bot className="h-4 w-4 text-primary" strokeWidth={1.75} />
                  <span>Conteúdo Markdown Gerado</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {data.markdown.length} caracteres
                </span>
              </div>

              {/* Prévia com Markdown e fórmulas KaTeX */}
              <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border bg-muted/20 p-4 print:max-h-none print:border-none print:bg-transparent print:p-0">
                <MarkdownMathRenderer content={data.markdown} />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={isLoading || isError || !data?.markdown}
              className="gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Imprimir / PDF</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isLoading || isError || !data?.markdown}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Baixar (.md)</span>
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => void handleCopy()}
              disabled={isLoading || isError || !data?.markdown}
              className="gap-1.5 font-semibold"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Copiar Markdown para IA</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
