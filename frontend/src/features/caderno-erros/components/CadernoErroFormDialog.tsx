import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateManualErrorSchema,
  ExternalLinkManualErrorSchema,
  GenericFullManualErrorSchema,
  UpdateCadernoErroSchema,
} from '@shared/schemas/caderno-erros.schema';
import type { CadernoErroDto } from '@shared/types/caderno-erros.types';
import type { ManualErrorOrigin } from '@shared/types/enums.types';
import type { LousaDto, LousaSummaryDto } from '@shared/types/lousas.types';
import type { TemaSummaryDto } from '@shared/types/temas.types';
import { ExternalLink, FileText, Loader2, Lock, Timer } from 'lucide-react';
import {
  useForm,
  type FieldValues,
  type Path,
  type UseFormSetError,
} from 'react-hook-form';
import { z } from 'zod';
import { MarkdownEditorField } from '@/components/markdown/MarkdownEditorField';
import { Badge } from '@/components/ui/badge';
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
import {
  useCreateCadernoErroMutation,
  useUpdateCadernoErroMutation,
} from '@/features/caderno-erros/hooks/useCadernoErros';
import {
  ERRO_ORIGEM_LABELS,
  MANUAL_ORIGEM_OPTIONS,
  QUESTAO_RESULTADO_LABELS,
  buildUpdateCadernoErroPayload,
} from '@/features/caderno-erros/utils/cadernoErros';
import { lousasApi } from '@/features/lousas/api/lousasApi';
import { LousaAttachmentField } from '@/features/lousas/components/LousaAttachmentField';
import { LousaCanvasModal } from '@/features/lousas/components/LousaCanvasModal';
import { TemaSelector } from '@/features/temas-revisao/components/TemaSelector';
import { getValidationFieldErrors } from '@/lib/errorMessages';
import { cn } from '@/lib/utils';

type ExternalLinkFormInput = z.input<typeof ExternalLinkManualErrorSchema>;
type ExternalLinkFormOutput = z.infer<typeof ExternalLinkManualErrorSchema>;

type GenericFullFormInput = z.input<typeof GenericFullManualErrorSchema>;
type GenericFullFormOutput = z.infer<typeof GenericFullManualErrorSchema>;

const SimuladoEditFormSchema = z.object({
  temaIds: ExternalLinkManualErrorSchema.shape.temaIds,
  observacaoErro: ExternalLinkManualErrorSchema.shape.observacaoErro,
  lousaId: ExternalLinkManualErrorSchema.shape.lousaId,
});

type SimuladoEditFormInput = z.input<typeof SimuladoEditFormSchema>;
type SimuladoEditFormOutput = z.infer<typeof SimuladoEditFormSchema>;

interface ManualDraftSnapshot {
  codigoReferencia: string;
  titulo: string;
  enunciadoCompleto: string;
  linkExterno: string;
  observacaoErro: string;
  temaIds: string[];
  selectedTemas: TemaSummaryDto[];
  lousaId: string | null;
  lousaPreview: LousaSummaryDto | null;
}

export interface CadernoErroFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingErro?: CadernoErroDto | null;
  defaultTema?: TemaSummaryDto | null;
}

function createDraftFromSource(
  editingErro: CadernoErroDto | null | undefined,
  defaultTema: TemaSummaryDto | null | undefined
): ManualDraftSnapshot {
  if (editingErro) {
    return {
      codigoReferencia: editingErro.codigoReferencia ?? '',
      titulo: editingErro.titulo ?? '',
      enunciadoCompleto: editingErro.enunciadoCompleto ?? '',
      linkExterno: editingErro.linkExterno ?? '',
      observacaoErro: editingErro.observacaoErro ?? '',
      temaIds: editingErro.temas.map((tema) => tema.id),
      selectedTemas: editingErro.temas,
      lousaId: editingErro.lousaId ?? null,
      lousaPreview: editingErro.lousa ?? null,
    };
  }

  return {
    codigoReferencia: '',
    titulo: '',
    enunciadoCompleto: '',
    linkExterno: '',
    observacaoErro: '',
    temaIds: defaultTema ? [defaultTema.id] : [],
    selectedTemas: defaultTema ? [defaultTema] : [],
    lousaId: null,
    lousaPreview: null,
  };
}

function applyServerFieldErrors<TFieldValues extends FieldValues>(
  error: unknown,
  allowedFields: ReadonlyArray<Path<TFieldValues>>,
  setError: UseFormSetError<TFieldValues>
): void {
  const fieldErrors = getValidationFieldErrors(error);
  const allowedSet = new Set<string>(allowedFields);

  for (const [path, message] of Object.entries(fieldErrors)) {
    if (allowedSet.has(path)) {
      setError(path as Path<TFieldValues>, {
        type: 'server',
        message,
      });
    }
  }
}

interface ExternalLinkSubformProps {
  isEditing: boolean;
  draft: ManualDraftSnapshot;
  snapshotGetterRef: MutableRefObject<(() => Partial<ManualDraftSnapshot>) | null>;
  isSubmitting: boolean;
  onRequestOpenLousa: () => void;
  onRemoveLousa: (lousaId: string | null) => void;
  onCancel: () => void;
  onSubmitExternalLink: (values: ExternalLinkFormOutput) => Promise<void>;
}

function ExternalLinkSubform({
  isEditing,
  draft,
  snapshotGetterRef,
  isSubmitting,
  onRequestOpenLousa,
  onRemoveLousa,
  onCancel,
  onSubmitExternalLink,
}: ExternalLinkSubformProps) {
  const selectedTemasRef = useRef<TemaSummaryDto[]>(draft.selectedTemas);
  const prevDraftRef = useRef<ManualDraftSnapshot>(draft);

  const form = useForm<ExternalLinkFormInput, unknown, ExternalLinkFormOutput>({
    resolver: zodResolver(ExternalLinkManualErrorSchema),
    defaultValues: {
      origem: 'EXTERNAL_LINK',
      codigoReferencia: draft.codigoReferencia,
      linkExterno: draft.linkExterno,
      titulo: draft.titulo,
      temaIds: draft.temaIds,
      observacaoErro: draft.observacaoErro,
      lousaId: draft.lousaId,
    },
  });

  const { reset } = form;

  useEffect(() => {
    if (prevDraftRef.current === draft) {
      return;
    }

    prevDraftRef.current = draft;
    selectedTemasRef.current = draft.selectedTemas;
    reset({
      origem: 'EXTERNAL_LINK',
      codigoReferencia: draft.codigoReferencia,
      linkExterno: draft.linkExterno,
      titulo: draft.titulo,
      temaIds: draft.temaIds,
      observacaoErro: draft.observacaoErro,
      lousaId: draft.lousaId,
    });
  }, [draft, reset]);

  useEffect(() => {
    snapshotGetterRef.current = () => {
      const current = form.getValues();
      return {
        codigoReferencia: current.codigoReferencia ?? '',
        linkExterno: current.linkExterno ?? '',
        titulo: current.titulo ?? '',
        temaIds: current.temaIds ?? [],
        observacaoErro: current.observacaoErro ?? '',
        selectedTemas: selectedTemasRef.current,
        lousaId: current.lousaId ?? null,
        lousaPreview: draft.lousaPreview,
      };
    };

    return () => {
      snapshotGetterRef.current = null;
    };
  }, [form, snapshotGetterRef, draft.lousaPreview]);

  const watchedTemaIds = form.watch('temaIds') ?? [];
  const watchedObservacao = form.watch('observacaoErro') ?? '';
  const watchedLousaId = form.watch('lousaId') ?? null;

  async function handleFormSubmit(
    values: ExternalLinkFormOutput
  ): Promise<void> {
    try {
      await onSubmitExternalLink(values);
    } catch (error) {
      applyServerFieldErrors(
        error,
        [
          'codigoReferencia',
          'linkExterno',
          'titulo',
          'temaIds',
          'observacaoErro',
          'lousaId',
        ],
        form.setError
      );
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleFormSubmit)}
      noValidate
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="erro-codigo-referencia">
            Código / Referência (obrigatório)
          </Label>
          <Input
            id="erro-codigo-referencia"
            autoFocus={!isEditing}
            disabled={isSubmitting}
            placeholder="Ex.: CF 1900C, 222A, ENEM 2023 Q138"
            className="font-mono"
            {...form.register('codigoReferencia')}
          />
          {form.formState.errors.codigoReferencia ? (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {form.formState.errors.codigoReferencia.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="erro-external-titulo">Título (opcional)</Label>
          <Input
            id="erro-external-titulo"
            disabled={isSubmitting}
            placeholder="Ex.: Anji's Binary Tree"
            {...form.register('titulo')}
          />
          {form.formState.errors.titulo ? (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {form.formState.errors.titulo.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Se ficar vazio, o código/referência será usado como título.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="erro-external-link">
          Link da questão (obrigatório)
        </Label>
        <Input
          id="erro-external-link"
          type="url"
          disabled={isSubmitting}
          placeholder="https://codeforces.com/problemset/problem/1900/C"
          {...form.register('linkExterno')}
        />
        {form.formState.errors.linkExterno ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            {form.formState.errors.linkExterno.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Temas vinculados (obrigatório)</Label>
        <TemaSelector
          mode="multiple"
          value={watchedTemaIds}
          initialSelectedTemas={draft.selectedTemas}
          disabled={isSubmitting}
          placeholder="Buscar tema existente ou criar novo..."
          onChange={(nextIds, nextSummaries) => {
            if (nextSummaries) {
              selectedTemasRef.current = nextSummaries;
            }
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
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="erro-external-observacao">
            Observação / diagnóstico (opcional)
          </Label>
          <span className="tabular-nums text-[11px] text-muted-foreground">
            {watchedObservacao.trim().length}/5000
          </span>
        </div>
        <MarkdownEditorField
          id="erro-external-observacao"
          rows={3}
          disabled={isSubmitting}
          previewContent={watchedObservacao}
          previewClassName="max-h-[260px] overflow-y-auto"
          placeholder="Anote o que travou, qual ideia resolve o problema ou o erro cometido..."
          className="leading-relaxed"
          {...form.register('observacaoErro')}
        />
        {form.formState.errors.observacaoErro ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            {form.formState.errors.observacaoErro.message}
          </p>
        ) : null}
      </div>

      <LousaAttachmentField
        label="Lousa do erro (opcional)"
        lousaId={watchedLousaId}
        lousaPreview={draft.lousaPreview}
        disabled={isSubmitting}
        errorMessage={form.formState.errors.lousaId?.message}
        onRequestOpenEditor={onRequestOpenLousa}
        onRemoveLousa={() => {
          onRemoveLousa(watchedLousaId);
          form.setValue('lousaId', null, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
      />

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              <span>Salvando...</span>
            </>
          ) : (
            <span>{isEditing ? 'Salvar alterações' : 'Registrar erro'}</span>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface GenericFullSubformProps {
  isEditing: boolean;
  draft: ManualDraftSnapshot;
  snapshotGetterRef: MutableRefObject<(() => Partial<ManualDraftSnapshot>) | null>;
  isSubmitting: boolean;
  onRequestOpenLousa: () => void;
  onRemoveLousa: (lousaId: string | null) => void;
  onCancel: () => void;
  onSubmitGenericFull: (values: GenericFullFormOutput) => Promise<void>;
}

function GenericFullSubform({
  isEditing,
  draft,
  snapshotGetterRef,
  isSubmitting,
  onRequestOpenLousa,
  onRemoveLousa,
  onCancel,
  onSubmitGenericFull,
}: GenericFullSubformProps) {
  const selectedTemasRef = useRef<TemaSummaryDto[]>(draft.selectedTemas);
  const prevDraftRef = useRef<ManualDraftSnapshot>(draft);

  const form = useForm<GenericFullFormInput, unknown, GenericFullFormOutput>({
    resolver: zodResolver(GenericFullManualErrorSchema),
    defaultValues: {
      origem: 'GENERIC_FULL',
      titulo: draft.titulo,
      enunciadoCompleto: draft.enunciadoCompleto,
      linkExterno: draft.linkExterno,
      temaIds: draft.temaIds,
      observacaoErro: draft.observacaoErro,
      lousaId: draft.lousaId,
    },
  });

  const { reset } = form;

  useEffect(() => {
    if (prevDraftRef.current === draft) {
      return;
    }

    prevDraftRef.current = draft;
    selectedTemasRef.current = draft.selectedTemas;
    reset({
      origem: 'GENERIC_FULL',
      titulo: draft.titulo,
      enunciadoCompleto: draft.enunciadoCompleto,
      linkExterno: draft.linkExterno,
      temaIds: draft.temaIds,
      observacaoErro: draft.observacaoErro,
      lousaId: draft.lousaId,
    });
  }, [draft, reset]);

  useEffect(() => {
    snapshotGetterRef.current = () => {
      const current = form.getValues();
      return {
        titulo: current.titulo ?? '',
        enunciadoCompleto: current.enunciadoCompleto ?? '',
        linkExterno: current.linkExterno ?? '',
        temaIds: current.temaIds ?? [],
        observacaoErro: current.observacaoErro ?? '',
        selectedTemas: selectedTemasRef.current,
        lousaId: current.lousaId ?? null,
        lousaPreview: draft.lousaPreview,
      };
    };

    return () => {
      snapshotGetterRef.current = null;
    };
  }, [form, snapshotGetterRef, draft.lousaPreview]);

  const watchedTemaIds = form.watch('temaIds') ?? [];
  const watchedEnunciado = form.watch('enunciadoCompleto') ?? '';
  const watchedObservacao = form.watch('observacaoErro') ?? '';
  const watchedLousaId = form.watch('lousaId') ?? null;

  async function handleFormSubmit(values: GenericFullFormOutput): Promise<void> {
    try {
      await onSubmitGenericFull(values);
    } catch (error) {
      applyServerFieldErrors(
        error,
        [
          'titulo',
          'enunciadoCompleto',
          'linkExterno',
          'temaIds',
          'observacaoErro',
          'lousaId',
        ],
        form.setError
      );
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleFormSubmit)}
      noValidate
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="erro-generic-titulo">
          Título da questão (obrigatório)
        </Label>
        <Input
          id="erro-generic-titulo"
          autoFocus={!isEditing}
          disabled={isSubmitting}
          placeholder="Ex.: Ponte de Wheatstone em equilíbrio"
          {...form.register('titulo')}
        />
        {form.formState.errors.titulo ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            {form.formState.errors.titulo.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="erro-generic-enunciado">
            Enunciado completo (obrigatório)
          </Label>
          <span className="tabular-nums text-[11px] text-muted-foreground">
            {watchedEnunciado.trim().length}/15000
          </span>
        </div>
        <MarkdownEditorField
          id="erro-generic-enunciado"
          rows={4}
          disabled={isSubmitting}
          previewContent={watchedEnunciado}
          previewClassName="min-h-[120px] max-h-[300px] overflow-y-auto"
          placeholder="Cole ou escreva o enunciado completo da questão para revisar sem depender de fontes externas..."
          className="min-h-[120px] leading-relaxed"
          {...form.register('enunciadoCompleto')}
        />
        {form.formState.errors.enunciadoCompleto ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            {form.formState.errors.enunciadoCompleto.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="erro-generic-link">
          Link de referência (opcional)
        </Label>
        <Input
          id="erro-generic-link"
          type="url"
          disabled={isSubmitting}
          placeholder="https://... (deixe vazio se não houver link)"
          {...form.register('linkExterno')}
        />
        {form.formState.errors.linkExterno ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            {form.formState.errors.linkExterno.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Temas vinculados (obrigatório)</Label>
        <TemaSelector
          mode="multiple"
          value={watchedTemaIds}
          initialSelectedTemas={draft.selectedTemas}
          disabled={isSubmitting}
          placeholder="Buscar tema existente ou criar novo..."
          onChange={(nextIds, nextSummaries) => {
            if (nextSummaries) {
              selectedTemasRef.current = nextSummaries;
            }
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
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="erro-generic-observacao">
            Observação / diagnóstico (opcional)
          </Label>
          <span className="tabular-nums text-[11px] text-muted-foreground">
            {watchedObservacao.trim().length}/5000
          </span>
        </div>
        <MarkdownEditorField
          id="erro-generic-observacao"
          rows={3}
          disabled={isSubmitting}
          previewContent={watchedObservacao}
          previewClassName="max-h-[260px] overflow-y-auto"
          placeholder="Anote o que motivou o erro, conceitos-chave ou pontos de atenção..."
          className="leading-relaxed"
          {...form.register('observacaoErro')}
        />
        {form.formState.errors.observacaoErro ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            {form.formState.errors.observacaoErro.message}
          </p>
        ) : null}
      </div>

      <LousaAttachmentField
        label="Lousa do erro (opcional)"
        lousaId={watchedLousaId}
        lousaPreview={draft.lousaPreview}
        disabled={isSubmitting}
        errorMessage={form.formState.errors.lousaId?.message}
        onRequestOpenEditor={onRequestOpenLousa}
        onRemoveLousa={() => {
          onRemoveLousa(watchedLousaId);
          form.setValue('lousaId', null, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
      />

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              <span>Salvando...</span>
            </>
          ) : (
            <span>{isEditing ? 'Salvar alterações' : 'Registrar erro'}</span>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface SimuladoEditSubformProps {
  editingErro: CadernoErroDto;
  draft: ManualDraftSnapshot;
  snapshotGetterRef: MutableRefObject<(() => Partial<ManualDraftSnapshot>) | null>;
  isSubmitting: boolean;
  onRequestOpenLousa: () => void;
  onRemoveLousa: (lousaId: string | null) => void;
  onCancel: () => void;
  onSubmitSimuladoEdit: (values: SimuladoEditFormOutput) => Promise<void>;
}

function SimuladoEditSubform({
  editingErro,
  draft,
  snapshotGetterRef,
  isSubmitting,
  onRequestOpenLousa,
  onRemoveLousa,
  onCancel,
  onSubmitSimuladoEdit,
}: SimuladoEditSubformProps) {
  const selectedTemasRef = useRef<TemaSummaryDto[]>(draft.selectedTemas);
  const prevDraftRef = useRef<ManualDraftSnapshot>(draft);

  const form = useForm<SimuladoEditFormInput, unknown, SimuladoEditFormOutput>({
    resolver: zodResolver(SimuladoEditFormSchema),
    defaultValues: {
      temaIds: draft.temaIds,
      observacaoErro: draft.observacaoErro,
      lousaId: draft.lousaId,
    },
  });

  const { reset } = form;

  useEffect(() => {
    if (prevDraftRef.current === draft) {
      return;
    }

    prevDraftRef.current = draft;
    selectedTemasRef.current = draft.selectedTemas;
    reset({
      temaIds: draft.temaIds,
      observacaoErro: draft.observacaoErro,
      lousaId: draft.lousaId,
    });
  }, [draft, reset]);

  useEffect(() => {
    snapshotGetterRef.current = () => {
      const current = form.getValues();
      return {
        temaIds: current.temaIds ?? [],
        observacaoErro: current.observacaoErro ?? '',
        selectedTemas: selectedTemasRef.current,
        lousaId: current.lousaId ?? null,
        lousaPreview: draft.lousaPreview,
      };
    };

    return () => {
      snapshotGetterRef.current = null;
    };
  }, [form, snapshotGetterRef, draft.lousaPreview]);

  const watchedTemaIds = form.watch('temaIds') ?? [];
  const watchedObservacao = form.watch('observacaoErro') ?? '';
  const watchedLousaId = form.watch('lousaId') ?? null;

  async function handleFormSubmit(
    values: SimuladoEditFormOutput
  ): Promise<void> {
    try {
      await onSubmitSimuladoEdit(values);
    } catch (error) {
      applyServerFieldErrors(
        error,
        ['temaIds', 'observacaoErro', 'lousaId'],
        form.setError
      );
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleFormSubmit)}
      noValidate
      className="space-y-4"
    >
      <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Timer className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span>
              {editingErro.simuladoMeta?.simuladoTitulo || 'Simulado vinculado'}
            </span>
          </span>

          {editingErro.simuladoMeta?.resultado ? (
            <Badge variant="outline" className="font-normal">
              {QUESTAO_RESULTADO_LABELS[editingErro.simuladoMeta.resultado]}
            </Badge>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {editingErro.simuladoMeta ? (
            <span className="shrink-0 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs font-medium text-foreground">
              {editingErro.simuladoMeta.numeroQuestao}
            </span>
          ) : null}
          <p className="min-w-0 break-words text-sm font-semibold text-foreground">
            {editingErro.simuladoMeta?.tituloQuestao ?? editingErro.titulo}
          </p>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Erros vindos de simulado permitem editar os temas vinculados, a
          observação pós-revisão e a lousa de rascunho.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Temas vinculados (obrigatório)</Label>
        <TemaSelector
          mode="multiple"
          value={watchedTemaIds}
          initialSelectedTemas={draft.selectedTemas}
          disabled={isSubmitting}
          placeholder="Buscar tema existente ou criar novo..."
          onChange={(nextIds, nextSummaries) => {
            if (nextSummaries) {
              selectedTemasRef.current = nextSummaries;
            }
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
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="erro-simulado-observacao">
            Observação pós-revisão (opcional)
          </Label>
          <span className="tabular-nums text-[11px] text-muted-foreground">
            {watchedObservacao.trim().length}/5000
          </span>
        </div>
        <MarkdownEditorField
          id="erro-simulado-observacao"
          rows={4}
          autoFocus
          disabled={isSubmitting}
          previewContent={watchedObservacao}
          previewClassName="max-h-[260px] overflow-y-auto"
          placeholder="Anote o que resolvia a questão do simulado e os cuidados para futuras provas..."
          className="leading-relaxed"
          {...form.register('observacaoErro')}
        />
        {form.formState.errors.observacaoErro ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            {form.formState.errors.observacaoErro.message}
          </p>
        ) : null}
      </div>

      <LousaAttachmentField
        label="Lousa do erro (opcional)"
        lousaId={watchedLousaId}
        lousaPreview={draft.lousaPreview}
        disabled={isSubmitting}
        errorMessage={form.formState.errors.lousaId?.message}
        onRequestOpenEditor={onRequestOpenLousa}
        onRemoveLousa={() => {
          onRemoveLousa(watchedLousaId);
          form.setValue('lousaId', null, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
      />

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              <span>Salvando...</span>
            </>
          ) : (
            <span>Salvar alterações</span>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CadernoErroFormDialog({
  open,
  onOpenChange,
  editingErro = null,
  defaultTema = null,
}: CadernoErroFormDialogProps) {
  const isEditing = editingErro !== null;
  const createMutation = useCreateCadernoErroMutation();
  const updateMutation = useUpdateCadernoErroMutation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const [manualOrigin, setManualOrigin] =
    useState<ManualErrorOrigin>('EXTERNAL_LINK');
  const [draft, setDraft] = useState<ManualDraftSnapshot>(() =>
    createDraftFromSource(editingErro, defaultTema)
  );
  const [isLousaEditorOpen, setIsLousaEditorOpen] = useState(false);
  const snapshotGetterRef = useRef<
    (() => Partial<ManualDraftSnapshot>) | null
  >(null);
  const sessionCreatedLousaIdsRef = useRef<Set<string>>(new Set());
  const wasOpenRef = useRef(false);
  const lastEditingIdRef = useRef<string | null>(editingErro?.id ?? null);
  const editingErroRef = useRef(editingErro);
  editingErroRef.current = editingErro;
  const defaultTemaRef = useRef(defaultTema);
  defaultTemaRef.current = defaultTema;

  const cleanupOrphanLousas = useCallback(() => {
    const ids = Array.from(sessionCreatedLousaIdsRef.current);
    sessionCreatedLousaIdsRef.current.clear();
    for (const id of ids) {
      void lousasApi.deleteLousa(id).catch(() => undefined);
    }
  }, []);

  const currentEditingId = editingErro?.id ?? null;

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    const editingChangedWhileOpen =
      open && lastEditingIdRef.current !== currentEditingId;
    wasOpenRef.current = open;
    lastEditingIdRef.current = currentEditingId;

    if (!open) {
      setIsLousaEditorOpen(false);
      return;
    }

    if (justOpened || editingChangedWhileOpen) {
      sessionCreatedLousaIdsRef.current.clear();
      setManualOrigin('EXTERNAL_LINK');
      setDraft(createDraftFromSource(editingErroRef.current, defaultTemaRef.current));
    }
  }, [open, currentEditingId]);

  function handleDialogOpenChange(nextOpen: boolean): void {
    if (!nextOpen && (isSubmitting || isLousaEditorOpen)) {
      return;
    }
    if (!nextOpen) {
      cleanupOrphanLousas();
    }
    onOpenChange(nextOpen);
  }

  function handleSelectManualOrigin(nextOrigin: ManualErrorOrigin): void {
    if (nextOrigin === manualOrigin || isSubmitting) {
      return;
    }

    const currentSnapshot = snapshotGetterRef.current?.();
    if (currentSnapshot) {
      setDraft((prev) => ({
        ...prev,
        ...currentSnapshot,
      }));
    }
    setManualOrigin(nextOrigin);
  }

  function handleRequestOpenLousa(): void {
    const currentSnapshot = snapshotGetterRef.current?.();
    if (currentSnapshot) {
      setDraft((prev) => ({
        ...prev,
        ...currentSnapshot,
      }));
    }
    setIsLousaEditorOpen(true);
  }

  function handleLousaSaved(savedLousa: LousaDto): void {
    if (!draft.lousaId) {
      sessionCreatedLousaIdsRef.current.add(savedLousa.id);
    }
    setDraft((prev) => ({
      ...prev,
      lousaId: savedLousa.id,
      lousaPreview: savedLousa,
    }));
    setIsLousaEditorOpen(false);
  }

  function handleRemoveLousa(currentLousaId: string | null): void {
    if (
      currentLousaId &&
      sessionCreatedLousaIdsRef.current.has(currentLousaId)
    ) {
      sessionCreatedLousaIdsRef.current.delete(currentLousaId);
      void lousasApi.deleteLousa(currentLousaId).catch(() => undefined);
    }
    const currentSnapshot = snapshotGetterRef.current?.();
    setDraft((prev) => ({
      ...prev,
      ...(currentSnapshot ?? {}),
      lousaId: null,
      lousaPreview: null,
    }));
  }

  async function handleSubmitExternalLink(
    values: ExternalLinkFormOutput
  ): Promise<void> {
    if (editingErro) {
      const payload = buildUpdateCadernoErroPayload({
        origem: 'EXTERNAL_LINK',
        codigoReferencia: values.codigoReferencia,
        linkExterno: values.linkExterno,
        titulo: values.titulo,
        observacaoErro: values.observacaoErro,
        lousaId: values.lousaId ?? null,
        temaIds: values.temaIds,
      });
      UpdateCadernoErroSchema.parse(payload);
      await updateMutation.mutateAsync({ id: editingErro.id, input: payload });
    } else {
      const validated = CreateManualErrorSchema.parse(values);
      await createMutation.mutateAsync(validated);
    }

    sessionCreatedLousaIdsRef.current.clear();
    onOpenChange(false);
  }

  async function handleSubmitGenericFull(
    values: GenericFullFormOutput
  ): Promise<void> {
    if (editingErro) {
      const payload = buildUpdateCadernoErroPayload({
        origem: 'GENERIC_FULL',
        titulo: values.titulo,
        enunciadoCompleto: values.enunciadoCompleto,
        linkExterno: values.linkExterno,
        observacaoErro: values.observacaoErro,
        lousaId: values.lousaId ?? null,
        temaIds: values.temaIds,
      });
      UpdateCadernoErroSchema.parse(payload);
      await updateMutation.mutateAsync({ id: editingErro.id, input: payload });
    } else {
      const validated = CreateManualErrorSchema.parse(values);
      await createMutation.mutateAsync(validated);
    }

    sessionCreatedLousaIdsRef.current.clear();
    onOpenChange(false);
  }

  async function handleSubmitSimuladoEdit(
    values: SimuladoEditFormOutput
  ): Promise<void> {
    if (!editingErro) {
      return;
    }

    const payload = buildUpdateCadernoErroPayload({
      origem: 'SIMULADO',
      observacaoErro: values.observacaoErro,
      lousaId: values.lousaId ?? null,
      temaIds: values.temaIds,
    });
    UpdateCadernoErroSchema.parse(payload);
    await updateMutation.mutateAsync({ id: editingErro.id, input: payload });
    sessionCreatedLousaIdsRef.current.clear();
    onOpenChange(false);
  }

  const activeOrigin = editingErro ? editingErro.origem : manualOrigin;

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
                ? 'Editar Registro do Caderno de Erros'
                : 'Registrar Erro Manual'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Atualize os dados do erro conforme as regras da origem deste registro.'
                : 'Cadastre manualmente uma questão externa ou completa para acompanhamento no Caderno de Erros.'}
            </DialogDescription>
          </DialogHeader>

          {isEditing && editingErro ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3.5 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <span>Origem do registro (travada):</span>
              </span>
              <Badge variant="outline" className="font-medium">
                {ERRO_ORIGEM_LABELS[editingErro.origem]}
              </Badge>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Origem da questão (exclusivamente manual)</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {MANUAL_ORIGEM_OPTIONS.map((option) => {
                  const isSelected = manualOrigin === option.value;
                  const Icon =
                    option.value === 'EXTERNAL_LINK' ? ExternalLink : FileText;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isSubmitting}
                      aria-pressed={isSelected}
                      onClick={() => handleSelectManualOrigin(option.value)}
                      className={cn(
                        'flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isSelected
                          ? 'border-primary/40 bg-primary/10 text-foreground'
                          : 'border-border bg-background hover:bg-accent'
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Icon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            isSelected ? 'text-primary' : 'text-muted-foreground'
                          )}
                          strokeWidth={1.75}
                        />
                        <span>{option.label}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeOrigin === 'SIMULADO' && editingErro ? (
            <SimuladoEditSubform
              editingErro={editingErro}
              draft={draft}
              snapshotGetterRef={snapshotGetterRef}
              isSubmitting={isSubmitting}
              onRequestOpenLousa={handleRequestOpenLousa}
              onRemoveLousa={handleRemoveLousa}
              onCancel={() => handleDialogOpenChange(false)}
              onSubmitSimuladoEdit={handleSubmitSimuladoEdit}
            />
          ) : activeOrigin === 'EXTERNAL_LINK' ? (
            <ExternalLinkSubform
              isEditing={isEditing}
              draft={draft}
              snapshotGetterRef={snapshotGetterRef}
              isSubmitting={isSubmitting}
              onRequestOpenLousa={handleRequestOpenLousa}
              onRemoveLousa={handleRemoveLousa}
              onCancel={() => handleDialogOpenChange(false)}
              onSubmitExternalLink={handleSubmitExternalLink}
            />
          ) : (
            <GenericFullSubform
              isEditing={isEditing}
              draft={draft}
              snapshotGetterRef={snapshotGetterRef}
              isSubmitting={isSubmitting}
              onRequestOpenLousa={handleRequestOpenLousa}
              onRemoveLousa={handleRemoveLousa}
              onCancel={() => handleDialogOpenChange(false)}
              onSubmitGenericFull={handleSubmitGenericFull}
            />
          )}
        </DialogContent>
      </Dialog>

      <LousaCanvasModal
        open={open && isLousaEditorOpen}
        onOpenChange={setIsLousaEditorOpen}
        lousaId={draft.lousaId}
        title={draft.lousaId ? 'Editar Lousa' : 'Desenhar na Lousa'}
        onSaved={handleLousaSaved}
      />
    </>
  );
}
