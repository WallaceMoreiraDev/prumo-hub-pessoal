import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ListUpdatingTopBarProps {
  isUpdating: boolean;
}

/**
 * Barra de progresso discreta e absoluta no topo do container de filtros,
 * evitando deslocamento de layout (layout shift) durante buscas e refetchs.
 */
export function ListUpdatingTopBar({ isUpdating }: ListUpdatingTopBarProps) {
  if (!isUpdating) {
    return null;
  }

  return (
    <div
      role="progressbar"
      aria-label="Atualizando resultados"
      aria-busy="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-primary/15"
    >
      <div className="h-full w-1/3 animate-prumo-progress rounded-full bg-primary/80" />
    </div>
  );
}

/**
 * Indicador textual enxuto de atualização em andamento (substitui o antigo silêncio do keepPreviousData).
 */
export function ListUpdatingStatus() {
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 font-medium text-foreground"
    >
      <Loader2
        className="h-3.5 w-3.5 shrink-0 animate-spin text-primary"
        strokeWidth={1.75}
      />
      <span>Atualizando resultados</span>
    </span>
  );
}

export interface SearchUpdatingSpinnerProps {
  isUpdating: boolean;
  hasClearButton: boolean;
}

/**
 * Ícone giratório posicionado na borda direita do campo de busca sem colidir com o botão de limpar.
 */
export function SearchUpdatingSpinner({
  isUpdating,
  hasClearButton,
}: SearchUpdatingSpinnerProps) {
  if (!isUpdating) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      data-testid="search-updating-spinner"
      className={cn(
        'pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center justify-center',
        hasClearButton ? 'right-9' : 'right-3'
      )}
    >
      <Loader2
        className="h-3.5 w-3.5 animate-spin text-primary"
        strokeWidth={1.75}
      />
    </span>
  );
}

export function getSearchInputPaddingClass(
  isUpdating: boolean,
  hasClearButton: boolean
): string {
  if (isUpdating && hasClearButton) {
    return 'pl-9 pr-14';
  }
  if (isUpdating || hasClearButton) {
    return 'pl-9 pr-9';
  }
  return 'pl-9 pr-3';
}
