import { useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateSimuladoSchema } from '@shared/schemas/simulados.schema';
import type { SimuladoDetalheDto } from '@shared/types/simulados.types';
import { Clock, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { useCreateSimuladoMutation } from '@/features/simulados/hooks/useSimulados';
import {
  SIMULADO_DURATION_PRESETS,
  SIMULADO_MAX_DURATION_SECONDS,
  formatConfiguredDuration,
  hoursMinutesToSeconds,
} from '@/features/simulados/utils/simulados';
import { getValidationFieldErrors } from '@/lib/errorMessages';
import { cn } from '@/lib/utils';

const SimuladoCreateFormSchema = z
  .object({
    titulo: CreateSimuladoSchema.shape.titulo,
    hours: z
      .number({ error: 'Informe um número válido de horas.' })
      .int({ error: 'As horas devem ser um número inteiro.' })
      .min(0, { error: 'As horas não podem ser negativas.' })
      .max(24, { error: 'O limite máximo é de 24 horas.' }),
    minutes: z
      .number({ error: 'Informe um número válido de minutos.' })
      .int({ error: 'Os minutos devem ser um número inteiro.' })
      .min(0, { error: 'Os minutos não podem ser negativos.' })
      .max(59, { error: 'Os minutos devem estar entre 0 e 59.' }),
  })
  .superRefine((values, ctx) => {
    const totalSeconds = hoursMinutesToSeconds(values.hours, values.minutes);
    if (totalSeconds < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['minutes'],
        message: 'A duração do simulado deve ser maior que zero.',
      });
    }
    if (totalSeconds > SIMULADO_MAX_DURATION_SECONDS) {
      ctx.addIssue({
        code: 'custom',
        path: ['minutes'],
        message: 'A duração máxima permitida é de 24 horas.',
      });
    }
  });

type SimuladoCreateFormInput = z.input<typeof SimuladoCreateFormSchema>;
type SimuladoCreateFormOutput = z.infer<typeof SimuladoCreateFormSchema>;

export interface SimuladoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (created: SimuladoDetalheDto) => void;
}

export function SimuladoFormDialog({
  open,
  onOpenChange,
  onCreated,
}: SimuladoFormDialogProps) {
  const createMutation = useCreateSimuladoMutation();
  const isSubmitting = createMutation.isPending;
  const wasOpenRef = useRef(false);

  const form = useForm<
    SimuladoCreateFormInput,
    unknown,
    SimuladoCreateFormOutput
  >({
    resolver: zodResolver(SimuladoCreateFormSchema),
    defaultValues: {
      titulo: '',
      hours: 4,
      minutes: 0,
    },
  });

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      form.reset({
        titulo: '',
        hours: 4,
        minutes: 0,
      });
    }
  }, [open, form]);

  const watchedHours = form.watch('hours');
  const watchedMinutes = form.watch('minutes');
  const previewSeconds = hoursMinutesToSeconds(
    Number.isFinite(watchedHours) ? watchedHours : 0,
    Number.isFinite(watchedMinutes) ? watchedMinutes : 0
  );

  function handleSelectPreset(hours: number, minutes: number): void {
    form.setValue('hours', hours, { shouldDirty: true, shouldValidate: true });
    form.setValue('minutes', minutes, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  async function handleSubmit(
    values: SimuladoCreateFormOutput
  ): Promise<void> {
    const duracaoConfiguradaSegundos = hoursMinutesToSeconds(
      values.hours,
      values.minutes
    );
    const parsedPayload = CreateSimuladoSchema.safeParse({
      titulo: values.titulo,
      duracaoConfiguradaSegundos,
    });

    if (!parsedPayload.success) {
      form.setError('minutes', {
        type: 'validate',
        message:
          parsedPayload.error.issues[0]?.message ?? 'Duração inválida.',
      });
      return;
    }

    try {
      const created = await createMutation.mutateAsync(parsedPayload.data);
      onOpenChange(false);
      onCreated?.(created);
    } catch (error) {
      const fieldErrors = getValidationFieldErrors(error);
      if (fieldErrors.titulo) {
        form.setError('titulo', {
          type: 'server',
          message: fieldErrors.titulo,
        });
      }
      if (fieldErrors.duracaoConfiguradaSegundos) {
        form.setError('minutes', {
          type: 'server',
          message: fieldErrors.duracaoConfiguradaSegundos,
        });
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Simulado</DialogTitle>
          <DialogDescription>
            Crie um simulado em preparação para anexar o PDF da prova e
            cadastrar as questões antes de iniciar o cronômetro.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          noValidate
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="simulado-titulo">Título do simulado</Label>
            <Input
              id="simulado-titulo"
              autoFocus
              maxLength={160}
              disabled={isSubmitting}
              placeholder="Ex.: OBI 2024 Fase 2 — Turno B"
              {...form.register('titulo')}
            />
            {form.formState.errors.titulo ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {form.formState.errors.titulo.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Clock className="h-4 w-4 text-primary" strokeWidth={1.75} />
                <span>Duração configurada</span>
              </div>
              <span className="font-mono text-xs font-semibold text-foreground tabular-nums">
                {previewSeconds > 0
                  ? formatConfiguredDuration(previewSeconds)
                  : '0min'}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SIMULADO_DURATION_PRESETS.map((preset) => {
                const isSelected =
                  watchedHours === preset.hours &&
                  watchedMinutes === preset.minutes;
                return (
                  <Button
                    key={preset.label}
                    type="button"
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    disabled={isSubmitting}
                    onClick={() =>
                      handleSelectPreset(preset.hours, preset.minutes)
                    }
                    className={cn(
                      'h-8 px-3 font-mono text-xs',
                      !isSelected && 'bg-background'
                    )}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="simulado-horas" className="text-xs">
                  Horas (0 a 24)
                </Label>
                <Input
                  id="simulado-horas"
                  type="number"
                  min={0}
                  max={24}
                  step={1}
                  disabled={isSubmitting}
                  className="font-mono"
                  {...form.register('hours', {
                    setValueAs: (val) =>
                      val === '' || val === null ? Number.NaN : Number(val),
                  })}
                />
                {form.formState.errors.hours ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {form.formState.errors.hours.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="simulado-minutos" className="text-xs">
                  Minutos (0 a 59)
                </Label>
                <Input
                  id="simulado-minutos"
                  type="number"
                  min={0}
                  max={59}
                  step={1}
                  disabled={isSubmitting}
                  className="font-mono"
                  {...form.register('minutes', {
                    setValueAs: (val) =>
                      val === '' || val === null ? Number.NaN : Number(val),
                  })}
                />
                {form.formState.errors.minutes ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {form.formState.errors.minutes.message}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Criando...</span>
                </>
              ) : (
                <span>Criar Simulado</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
