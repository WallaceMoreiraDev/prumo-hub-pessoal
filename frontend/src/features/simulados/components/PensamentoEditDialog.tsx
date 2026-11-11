import { useEffect, useMemo, useRef, useState } from 'react';
import { UpdateSimuladoPensamentoSchema } from '@shared/schemas/simulados.schema';
import type {
  SimuladoPensamentoDto,
  SimuladoQuestaoDto,
} from '@shared/types/simulados.types';
import { Clock, Loader2 } from 'lucide-react';
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
import { SmartPasteTextarea } from '@/components/markdown/SmartPasteTextarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatTempoDecorrido } from '@/features/caderno-erros/utils/cadernoErros';
import { useUpdatePensamentoMutation } from '@/features/simulados/hooks/useSimulados';
import { parseThoughtTimestampInput } from '@/features/simulados/utils/simulados';
import { getValidationFieldErrors } from '@/lib/errorMessages';

export interface PensamentoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  simuladoId: string;
  pensamento: SimuladoPensamentoDto | null;
  questoes: readonly SimuladoQuestaoDto[];
}

interface PensamentoEditErrors {
  simuladoQuestaoId?: string;
  timestampInput?: string;
  descricao?: string;
  form?: string;
}

export function PensamentoEditDialog({
  open,
  onOpenChange,
  simuladoId,
  pensamento,
  questoes,
}: PensamentoEditDialogProps) {
  const updateMutation = useUpdatePensamentoMutation();
  const isSubmitting = updateMutation.isPending;

  const [simuladoQuestaoId, setSimuladoQuestaoId] = useState('');
  const [timestampInput, setTimestampInput] = useState('');
  const [descricao, setDescricao] = useState('');
  const [errors, setErrors] = useState<PensamentoEditErrors>({});

  const wasOpenRef = useRef(false);
  const lastPensamentoIdRef = useRef<string | null>(null);

  const sortedQuestoes = useMemo(
    () =>
      [...questoes].sort((a, b) => {
        if (a.ordem !== b.ordem) {
          return a.ordem - b.ordem;
        }
        return a.createdAt.localeCompare(b.createdAt);
      }),
    [questoes]
  );

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    const currentId = pensamento?.id ?? null;
    const justOpened = !wasOpenRef.current;
    const targetChanged = lastPensamentoIdRef.current !== currentId;

    if (!justOpened && !targetChanged) {
      return;
    }

    wasOpenRef.current = true;
    lastPensamentoIdRef.current = currentId;

    if (pensamento) {
      setSimuladoQuestaoId(pensamento.simuladoQuestaoId);
      setTimestampInput(
        formatTempoDecorrido(pensamento.tempoDecorridoSegundos) ?? ''
      );
      setDescricao(pensamento.descricao);
    } else {
      setSimuladoQuestaoId(sortedQuestoes[0]?.id ?? '');
      setTimestampInput('');
      setDescricao('');
    }
    setErrors({});
  }, [open, pensamento, sortedQuestoes]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    if (!pensamento || isSubmitting) {
      return;
    }

    const nextErrors: PensamentoEditErrors = {};
    const parsedTimestamp = parseThoughtTimestampInput(timestampInput);
    if (!parsedTimestamp.valid) {
      nextErrors.timestampInput = parsedTimestamp.message;
    }

    const schemaResult = UpdateSimuladoPensamentoSchema.safeParse({
      simuladoQuestaoId,
      descricao,
      tempoDecorridoSegundos: parsedTimestamp.valid
        ? parsedTimestamp.seconds
        : pensamento.tempoDecorridoSegundos,
    });

    if (!schemaResult.success) {
      for (const issue of schemaResult.error.issues) {
        const path = issue.path[0];
        if (path === 'simuladoQuestaoId' && !nextErrors.simuladoQuestaoId) {
          nextErrors.simuladoQuestaoId = issue.message;
        } else if (
          path === 'tempoDecorridoSegundos' &&
          !nextErrors.timestampInput
        ) {
          nextErrors.timestampInput = issue.message;
        } else if (path === 'descricao' && !nextErrors.descricao) {
          nextErrors.descricao = issue.message;
        } else if (!nextErrors.form) {
          nextErrors.form = issue.message;
        }
      }
    }

    if (Object.keys(nextErrors).length > 0 || !schemaResult.success) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    try {
      await updateMutation.mutateAsync({
        simuladoId,
        pensamentoId: pensamento.id,
        input: schemaResult.data,
      });
      onOpenChange(false);
    } catch (error) {
      const serverFields = getValidationFieldErrors(error);
      if (Object.keys(serverFields).length > 0) {
        setErrors({
          simuladoQuestaoId: serverFields.simuladoQuestaoId,
          timestampInput: serverFields.tempoDecorridoSegundos,
          descricao: serverFields.descricao,
        });
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Pensamento</DialogTitle>
          <DialogDescription>
            Ajuste a questão vinculada, o carimbo de tempo ou o texto do
            pensamento registrado na prova.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="min-w-0 space-y-4">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="edit-pensamento-questao">Questão vinculada</Label>
            <Select
              value={simuladoQuestaoId}
              disabled={isSubmitting || sortedQuestoes.length === 0}
              onValueChange={(value) => {
                setSimuladoQuestaoId(value);
                if (errors.simuladoQuestaoId) {
                  setErrors((prev) => ({
                    ...prev,
                    simuladoQuestaoId: undefined,
                  }));
                }
              }}
            >
              <SelectTrigger
                id="edit-pensamento-questao"
                aria-label="Selecionar questão vinculada"
              >
                <SelectValue placeholder="Selecione uma questão..." />
              </SelectTrigger>
              <SelectContent className="max-w-[calc(100vw-2rem)]">
                {sortedQuestoes.map((questao) => (
                  <SelectItem
                    key={questao.id}
                    value={questao.id}
                    title={`${questao.numeroQuestao} — ${questao.tituloQuestao}`}
                    className="[&>span:last-child]:min-w-0 [&>span:last-child]:truncate"
                  >
                    {questao.numeroQuestao} — {questao.tituloQuestao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.simuladoQuestaoId ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {errors.simuladoQuestaoId}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-pensamento-timestamp">
              Carimbo de tempo decorrido (opcional)
            </Label>
            <div className="relative">
              <Clock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.75}
              />
              <Input
                id="edit-pensamento-timestamp"
                type="text"
                value={timestampInput}
                disabled={isSubmitting}
                onChange={(event) => {
                  setTimestampInput(event.target.value);
                  if (errors.timestampInput) {
                    setErrors((prev) => ({
                      ...prev,
                      timestampInput: undefined,
                    }));
                  }
                }}
                placeholder="Ex.: 14:30 ou 01:05:20"
                className="pl-9 font-mono"
              />
            </div>
            {errors.timestampInput ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {errors.timestampInput}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Use MM:SS ou HH:MM:SS. Deixe em branco para remover o carimbo.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="edit-pensamento-descricao">Pensamento</Label>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {descricao.length}/4000
              </span>
            </div>
            <SmartPasteTextarea
              id="edit-pensamento-descricao"
              rows={4}
              maxLength={4000}
              disabled={isSubmitting}
              value={descricao}
              onChange={(event) => {
                setDescricao(event.target.value);
                if (errors.descricao) {
                  setErrors((prev) => ({ ...prev, descricao: undefined }));
                }
              }}
              placeholder="Descreva a ideia, hipótese ou dificuldade enfrentada..."
            />
            {errors.descricao ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {errors.descricao}
              </p>
            ) : null}
          </div>

          {errors.form ? (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {errors.form}
            </p>
          ) : null}

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
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar alterações</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
