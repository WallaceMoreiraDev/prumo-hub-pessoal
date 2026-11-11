import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateReflexaoSchema,
  type CreateReflexaoFormInput,
  type CreateReflexaoInput,
} from '@shared/schemas/temas.schema';
import type { ReflexaoDto, TemaSummaryDto } from '@shared/types/temas.types';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { MarkdownEditorField } from '@/components/markdown/MarkdownEditorField';
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
import {
  useCreateReflexaoMutation,
  useUpdateReflexaoMutation,
} from '@/features/temas-revisao/hooks/useTemas';

export interface ReflexaoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingReflexao?: ReflexaoDto | null;
  defaultTemaPrincipal?: TemaSummaryDto | null;
  focusConnectedSection?: boolean;
}

export function ReflexaoFormDialog({
  open,
  onOpenChange,
  editingReflexao = null,
  defaultTemaPrincipal = null,
  focusConnectedSection = false,
}: ReflexaoFormDialogProps) {
  const isEditing = Boolean(editingReflexao);
  const createMutation = useCreateReflexaoMutation();
  const updateMutation = useUpdateReflexaoMutation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const form = useForm<CreateReflexaoFormInput, unknown, CreateReflexaoInput>({
    resolver: zodResolver(CreateReflexaoSchema),
    defaultValues: {
      temaPrincipalId:
        editingReflexao?.temaPrincipalId ?? defaultTemaPrincipal?.id ?? '',
      temaConectadoIds:
        editingReflexao?.temasConectados.map((tema) => tema.id) ?? [],
      conteudo: editingReflexao?.conteudo ?? '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        temaPrincipalId:
          editingReflexao?.temaPrincipalId ?? defaultTemaPrincipal?.id ?? '',
        temaConectadoIds:
          editingReflexao?.temasConectados.map((tema) => tema.id) ?? [],
        conteudo: editingReflexao?.conteudo ?? '',
      });
    }
  }, [open, editingReflexao, defaultTemaPrincipal, form]);

  const watchedPrincipalId = form.watch('temaPrincipalId');
  const watchedConnectedIds = form.watch('temaConectadoIds') ?? [];
  const watchedConteudo = form.watch('conteudo') ?? '';

  const initialPrincipalTemas = useMemo<TemaSummaryDto[]>(() => {
    const list: TemaSummaryDto[] = [];
    if (editingReflexao?.temaPrincipal) {
      list.push(editingReflexao.temaPrincipal);
    } else if (defaultTemaPrincipal) {
      list.push(defaultTemaPrincipal);
    }
    return list;
  }, [editingReflexao, defaultTemaPrincipal]);

  const initialConnectedTemas = useMemo<TemaSummaryDto[]>(() => {
    return editingReflexao?.temasConectados ?? [];
  }, [editingReflexao]);

  function handlePrincipalChange(nextId: string | null): void {
    const normalizedId = nextId ?? '';
    form.setValue('temaPrincipalId', normalizedId, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (normalizedId && watchedConnectedIds.includes(normalizedId)) {
      form.setValue(
        'temaConectadoIds',
        watchedConnectedIds.filter((id) => id !== normalizedId),
        { shouldDirty: true, shouldValidate: true }
      );
    }
  }

  async function handleSubmit(values: CreateReflexaoInput): Promise<void> {
    try {
      if (editingReflexao) {
        await updateMutation.mutateAsync({
          id: editingReflexao.id,
          input: values,
        });
      } else {
        await createMutation.mutateAsync(values);
      }
      onOpenChange(false);
    } catch {
      // Erro já exibido via toast no hook.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? 'Editar Reflexão / Conexão'
              : focusConnectedSection
                ? 'Conectar Temas'
                : 'Nova Reflexão'}
          </DialogTitle>
          <DialogDescription>
            Registre uma anotação própria sobre um tema ou conecte-o com outros
            temas para gerar uma ponte bidirecional.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          noValidate
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label>Tema principal (obrigatório)</Label>
            <TemaSelector
              mode="single"
              value={watchedPrincipalId || null}
              initialSelectedTemas={initialPrincipalTemas}
              disabled={isSubmitting}
              placeholder="Selecionar ou criar tema principal..."
              onChange={(nextId) => handlePrincipalChange(nextId)}
            />
            {form.formState.errors.temaPrincipalId ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Selecione um tema principal válido para a reflexão.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Conexões com outros temas (opcional)</Label>
              <span className="text-xs text-muted-foreground">
                {watchedConnectedIds.length === 0
                  ? 'Sem conexões: ficará em Reflexões Próprias'
                  : `${watchedConnectedIds.length} conectado(s) — visível nos dois lados`}
              </span>
            </div>
            <TemaSelector
              mode="multiple"
              value={watchedConnectedIds}
              excludeIds={watchedPrincipalId ? [watchedPrincipalId] : []}
              initialSelectedTemas={initialConnectedTemas}
              disabled={isSubmitting}
              autoFocusSearch={focusConnectedSection}
              placeholder="Buscar tema para conectar..."
              emptyLabel="Nenhum outro tema disponível para conexão."
              onChange={(nextIds) => {
                form.setValue('temaConectadoIds', nextIds, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
            {form.formState.errors.temaConectadoIds ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {form.formState.errors.temaConectadoIds.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="reflexao-conteudo">Conteúdo da reflexão</Label>
              <span className="tabular-nums text-[11px] text-muted-foreground">
                {watchedConteudo.trim().length}/5000
              </span>
            </div>
            <MarkdownEditorField
              id="reflexao-conteudo"
              rows={4}
              disabled={isSubmitting}
              previewContent={watchedConteudo}
              previewClassName="min-h-[120px] max-h-[300px] overflow-y-auto"
              placeholder="Descreva o insight, critério de escolha, armadilha comum ou relação entre os temas..."
              className="min-h-[120px] leading-relaxed"
              {...form.register('conteudo')}
            />
            {form.formState.errors.conteudo ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {form.formState.errors.conteudo.message}
              </p>
            ) : null}
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
                  <span>Salvando...</span>
                </>
              ) : (
                <span>
                  {isEditing ? 'Salvar alterações' : 'Salvar reflexão'}
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
