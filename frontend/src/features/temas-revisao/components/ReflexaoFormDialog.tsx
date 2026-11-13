import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateReflexaoSchema,
  type CreateReflexaoFormInput,
  type CreateReflexaoInput,
} from '@shared/schemas/temas.schema';
import type { LousaDto, LousaSummaryDto } from '@shared/types/lousas.types';
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
import { lousasApi } from '@/features/lousas/api/lousasApi';
import { LousaAttachmentField } from '@/features/lousas/components/LousaAttachmentField';
import { LousaCanvasModal } from '@/features/lousas/components/LousaCanvasModal';
import { TemaSelector } from '@/features/temas-revisao/components/TemaSelector';
import {
  useCreateReflexaoMutation,
  useUpdateReflexaoMutation,
} from '@/features/temas-revisao/hooks/useTemas';
import { getValidationFieldErrors } from '@/lib/errorMessages';

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

  const [attachedLousa, setAttachedLousa] = useState<LousaSummaryDto | null>(
    editingReflexao?.lousa ?? null
  );
  const [selectedPrincipalTema, setSelectedPrincipalTema] =
    useState<TemaSummaryDto | null>(
      editingReflexao?.temaPrincipal ?? defaultTemaPrincipal ?? null
    );
  const [selectedConnectedTemas, setSelectedConnectedTemas] = useState<
    TemaSummaryDto[]
  >(editingReflexao?.temasConectados ?? []);
  const [isLousaEditorOpen, setIsLousaEditorOpen] = useState(false);

  const sessionCreatedLousaIdsRef = useRef<Set<string>>(new Set());
  const wasOpenRef = useRef(false);
  const lastEditingIdRef = useRef<string | null>(editingReflexao?.id ?? null);
  const defaultTemaPrincipalRef = useRef(defaultTemaPrincipal);
  defaultTemaPrincipalRef.current = defaultTemaPrincipal;
  const editingReflexaoRef = useRef(editingReflexao);
  editingReflexaoRef.current = editingReflexao;

  const cleanupOrphanLousas = useCallback(() => {
    const ids = Array.from(sessionCreatedLousaIdsRef.current);
    sessionCreatedLousaIdsRef.current.clear();
    for (const id of ids) {
      void lousasApi.deleteLousa(id).catch(() => undefined);
    }
  }, []);

  const form = useForm<CreateReflexaoFormInput, unknown, CreateReflexaoInput>({
    resolver: zodResolver(CreateReflexaoSchema),
    defaultValues: {
      temaPrincipalId:
        editingReflexao?.temaPrincipalId ?? defaultTemaPrincipal?.id ?? '',
      temaConectadoIds:
        editingReflexao?.temasConectados.map((tema) => tema.id) ?? [],
      conteudo: editingReflexao?.conteudo ?? '',
      lousaId: editingReflexao?.lousaId ?? null,
    },
  });

  const editingId = editingReflexao?.id ?? null;

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    const editingChangedWhileOpen = open && editingId !== lastEditingIdRef.current;
    wasOpenRef.current = open;
    lastEditingIdRef.current = editingId;

    if (!open) {
      setIsLousaEditorOpen(false);
      return;
    }

    if (justOpened || editingChangedWhileOpen) {
      const currentEditing = editingReflexaoRef.current;
      const currentDefaultTema = defaultTemaPrincipalRef.current;

      sessionCreatedLousaIdsRef.current.clear();
      setIsLousaEditorOpen(false);
      setAttachedLousa(currentEditing?.lousa ?? null);
      setSelectedPrincipalTema(
        currentEditing?.temaPrincipal ?? currentDefaultTema ?? null
      );
      setSelectedConnectedTemas(currentEditing?.temasConectados ?? []);

      form.reset({
        temaPrincipalId:
          currentEditing?.temaPrincipalId ?? currentDefaultTema?.id ?? '',
        temaConectadoIds:
          currentEditing?.temasConectados.map((tema) => tema.id) ?? [],
        conteudo: currentEditing?.conteudo ?? '',
        lousaId: currentEditing?.lousaId ?? null,
      });
    }
  }, [open, editingId, form]);

  const watchedPrincipalId = form.watch('temaPrincipalId');
  const watchedConnectedIds = form.watch('temaConectadoIds') ?? [];
  const watchedConteudo = form.watch('conteudo') ?? '';
  const watchedLousaId = form.watch('lousaId') ?? null;

  const initialPrincipalTemas = useMemo<TemaSummaryDto[]>(() => {
    return selectedPrincipalTema ? [selectedPrincipalTema] : [];
  }, [selectedPrincipalTema]);

  function handlePrincipalChange(
    nextId: string | null,
    nextTema?: TemaSummaryDto
  ): void {
    const normalizedId = nextId ?? '';
    if (nextId && nextTema) {
      setSelectedPrincipalTema(nextTema);
    } else if (!nextId) {
      setSelectedPrincipalTema(null);
    }

    form.setValue('temaPrincipalId', normalizedId, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (normalizedId && watchedConnectedIds.includes(normalizedId)) {
      const remainingIds = watchedConnectedIds.filter(
        (id) => id !== normalizedId
      );
      setSelectedConnectedTemas((prev) =>
        prev.filter((tema) => tema.id !== normalizedId)
      );
      form.setValue('temaConectadoIds', remainingIds, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }

  function handleAttachLousa(savedLousa: LousaDto): void {
    const previousId = form.getValues('lousaId') ?? null;
    if (!previousId) {
      sessionCreatedLousaIdsRef.current.add(savedLousa.id);
    }

    setAttachedLousa(savedLousa);
    form.setValue('lousaId', savedLousa.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.clearErrors('conteudo');
  }

  function handleRemoveLousa(): void {
    const currentId = form.getValues('lousaId') ?? null;
    if (currentId && sessionCreatedLousaIdsRef.current.has(currentId)) {
      sessionCreatedLousaIdsRef.current.delete(currentId);
      void lousasApi.deleteLousa(currentId).catch(() => undefined);
    }

    setAttachedLousa(null);
    form.setValue('lousaId', null, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleDialogOpenChange(nextOpen: boolean): void {
    if (!nextOpen && (isSubmitting || isLousaEditorOpen)) {
      return;
    }
    if (!nextOpen) {
      cleanupOrphanLousas();
    }
    onOpenChange(nextOpen);
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
      sessionCreatedLousaIdsRef.current.clear();
      onOpenChange(false);
    } catch (error) {
      const fieldErrors = getValidationFieldErrors(error);
      for (const [path, message] of Object.entries(fieldErrors)) {
        if (
          path === 'temaPrincipalId' ||
          path === 'temaConectadoIds' ||
          path === 'conteudo' ||
          path === 'lousaId'
        ) {
          form.setError(path, { type: 'server', message });
        }
      }
    }
  }

  return (
    <>
      <Dialog
        open={open && !isLousaEditorOpen}
        onOpenChange={handleDialogOpenChange}
      >
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
              Registre uma anotação própria sobre um tema ou conecte-o com
              outros temas para gerar uma ponte bidirecional.
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
                onChange={(nextId, nextTema) =>
                  handlePrincipalChange(nextId, nextTema)
                }
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
                initialSelectedTemas={selectedConnectedTemas}
                disabled={isSubmitting}
                autoFocusSearch={focusConnectedSection}
                placeholder="Buscar tema para conectar..."
                emptyLabel="Nenhum outro tema disponível para conexão."
                onChange={(nextIds, nextTemas) => {
                  if (nextTemas) {
                    setSelectedConnectedTemas(nextTemas);
                  }
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
                <Label htmlFor="reflexao-conteudo">
                  Conteúdo em texto (opcional se houver lousa)
                </Label>
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

            <LousaAttachmentField
              label="Lousa da reflexão (opcional)"
              helperText="Se preferir, anexe uma lousa manuscrita com diagramas ou equações."
              lousaId={watchedLousaId}
              lousaPreview={attachedLousa}
              disabled={isSubmitting}
              errorMessage={form.formState.errors.lousaId?.message}
              onRequestOpenEditor={() => setIsLousaEditorOpen(true)}
              onRemoveLousa={handleRemoveLousa}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => handleDialogOpenChange(false)}
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

      <LousaCanvasModal
        open={open && isLousaEditorOpen}
        onOpenChange={setIsLousaEditorOpen}
        lousaId={watchedLousaId}
        title={watchedLousaId ? 'Editar Lousa' : 'Desenhar na Lousa'}
        onSaved={(savedLousa) => {
          handleAttachLousa(savedLousa);
          setIsLousaEditorOpen(false);
        }}
      />
    </>
  );
}
