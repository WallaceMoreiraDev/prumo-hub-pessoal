import type { LousaSummaryDto } from '@shared/types/lousas.types';
import { Pencil, PenTool, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LousaPreviewCard } from '@/features/lousas/components/LousaPreviewCard';

export interface LousaAttachmentFieldProps {
  label?: string;
  helperText?: string;
  lousaId: string | null;
  lousaPreview: LousaSummaryDto | null;
  disabled?: boolean;
  errorMessage?: string;
  onRequestOpenEditor: () => void;
  onRemoveLousa: () => void;
}

export function LousaAttachmentField({
  label = 'Lousa interativa (opcional)',
  helperText = 'Esboce diagramas, equações manuscritas ou fluxos diretamente na tela.',
  lousaId,
  lousaPreview,
  disabled = false,
  errorMessage,
  onRequestOpenEditor,
  onRemoveLousa,
}: LousaAttachmentFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{label}</Label>
        {!lousaId ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onRequestOpenEditor}
            className="gap-1.5"
          >
            <PenTool className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
            <span>Desenhar na lousa</span>
          </Button>
        ) : null}
      </div>

      {!lousaId ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {helperText}
        </p>
      ) : lousaPreview ? (
        <div className="space-y-2">
          <LousaPreviewCard
            lousa={lousaPreview}
            compact
            title="Rascunho da lousa"
            onEditClick={onRequestOpenEditor}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={onRemoveLousa}
              className="h-7 gap-1.5 text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Remover lousa</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs text-foreground">
            <PenTool className="h-4 w-4 text-primary" strokeWidth={1.75} />
            <span>Lousa vinculada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={onRequestOpenEditor}
              className="h-7 gap-1.5 px-2.5 text-xs"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Editar na lousa</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={onRemoveLousa}
              className="h-7 gap-1 px-2 text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Remover</span>
            </Button>
          </div>
        </div>
      )}

      {errorMessage ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
