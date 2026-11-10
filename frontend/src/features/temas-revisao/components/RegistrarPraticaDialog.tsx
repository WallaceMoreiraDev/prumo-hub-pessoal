import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  RegistrarPraticaSchema,
  type RegistrarPraticaInput,
} from '@shared/schemas/temas.schema';
import type { ReviewMode } from '@shared/types/enums.types';
import type { TemaSummaryDto } from '@shared/types/temas.types';
import { CheckCircle2, LifeBuoy, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { TemaSelector } from '@/features/temas-revisao/components/TemaSelector';
import { useRegistrarPraticaMutation } from '@/features/temas-revisao/hooks/useTemas';
import { cn } from '@/lib/utils';

export interface RegistrarPraticaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTemas?: TemaSummaryDto[];
}

export function RegistrarPraticaDialog({
  open,
  onOpenChange,
  initialTemas = [],
}: RegistrarPraticaDialogProps) {
  const registrarPraticaMutation = useRegistrarPraticaMutation();

  const form = useForm<RegistrarPraticaInput>({
    resolver: zodResolver(RegistrarPraticaSchema),
    defaultValues: {
      temaIds: initialTemas.map((tema) => tema.id),
      reviewMode: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        temaIds: initialTemas.map((tema) => tema.id),
        reviewMode: undefined,
      });
    }
  }, [open, initialTemas, form]);

  const watchedTemaIds = form.watch('temaIds') ?? [];
  const watchedReviewMode = form.watch('reviewMode');

  async function handleSubmit(values: RegistrarPraticaInput): Promise<void> {
    try {
      await registrarPraticaMutation.mutateAsync(values);
      onOpenChange(false);
    } catch {
      // Erro tratado via toast no hook.
    }
  }

  function handleSelectReviewMode(mode: ReviewMode): void {
    form.setValue('reviewMode', mode, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar Prática / Revisão</DialogTitle>
          <DialogDescription>
            Atualize a data da última revisão de um ou mais temas com base na
            sua prática avulsa de hoje.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          noValidate
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label>Temas praticados</Label>
            <TemaSelector
              mode="multiple"
              value={watchedTemaIds}
              initialSelectedTemas={initialTemas}
              disabled={registrarPraticaMutation.isPending}
              placeholder="Buscar tema existente ou criar novo..."
              onChange={(nextIds) => {
                form.setValue('temaIds', nextIds, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
            {form.formState.errors.temaIds ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {form.formState.errors.temaIds.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Como você concluiu a prática?</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={registrarPraticaMutation.isPending}
                onClick={() => handleSelectReviewMode('SOLO')}
                className={cn(
                  'flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  watchedReviewMode === 'SOLO'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-border bg-background hover:bg-accent'
                )}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  <CheckCircle2
                    className={cn(
                      'h-4 w-4 shrink-0',
                      watchedReviewMode === 'SOLO'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground'
                    )}
                    strokeWidth={1.75}
                  />
                  <span>Sozinho</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Resolvi ou revisei o conteúdo com autonomia, sem consulta.
                </p>
              </button>

              <button
                type="button"
                disabled={registrarPraticaMutation.isPending}
                onClick={() => handleSelectReviewMode('HELP')}
                className={cn(
                  'flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  watchedReviewMode === 'HELP'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'border-border bg-background hover:bg-accent'
                )}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  <LifeBuoy
                    className={cn(
                      'h-4 w-4 shrink-0',
                      watchedReviewMode === 'HELP'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground'
                    )}
                    strokeWidth={1.75}
                  />
                  <span>Com Ajuda</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Precisei de dica, gabarito ou revisão guiada.
                </p>
              </button>
            </div>
            {form.formState.errors.reviewMode ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Selecione uma opção: Sozinho ou Com Ajuda.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={registrarPraticaMutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={registrarPraticaMutation.isPending}
            >
              {registrarPraticaMutation.isPending ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Registrando...</span>
                </>
              ) : (
                <span>Registrar prática</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
