import type { CadernoErroDto } from '@shared/types/caderno-erros.types';
import type { ReviewMode } from '@shared/types/enums.types';
import {
  CheckCircle2,
  ChevronRight,
  LifeBuoy,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CadernoErroDrawerContent } from '@/features/caderno-erros/components/CadernoErroDrawerContent';
import { ERRO_ORIGEM_LABELS } from '@/features/caderno-erros/utils/cadernoErros';
import { formatLocalDate } from '@/lib/date';
import { cn } from '@/lib/utils';

const MAX_TEMA_PREVIEW_BADGES = 3;

export interface CadernoErroRowAccordionProps {
  erro: CadernoErroDto;
  isExpanded: boolean;
  activeReviewMode: ReviewMode | null;
  isDevolving: boolean;
  onToggleExpand: (id: string) => void;
  onRevisar: (id: string, mode: ReviewMode) => void;
  onDevolver: (id: string) => void;
  onEdit: (erro: CadernoErroDto) => void;
  onDelete: (erro: CadernoErroDto) => void;
}

export function CadernoErroRowAccordion({
  erro,
  isExpanded,
  activeReviewMode,
  isDevolving,
  onToggleExpand,
  onRevisar,
  onDevolver,
  onEdit,
  onDelete,
}: CadernoErroRowAccordionProps) {
  const showHelpHighlight =
    erro.status === 'REVISADO' && erro.lastReviewMode === 'HELP';
  const isSoloReviewed =
    erro.status === 'REVISADO' && erro.lastReviewMode === 'SOLO';
  const isBusy = activeReviewMode !== null || isDevolving;

  const normalizedCodigo = erro.codigoReferencia?.trim() ?? '';
  const normalizedTitulo = erro.titulo.trim();
  const showSeparateCodigoBadge =
    erro.origem === 'EXTERNAL_LINK' &&
    normalizedCodigo.length > 0 &&
    normalizedCodigo !== normalizedTitulo;
  const useMonoTitle =
    erro.origem === 'EXTERNAL_LINK' &&
    normalizedCodigo.length > 0 &&
    normalizedCodigo === normalizedTitulo;

  const visibleTemas = erro.temas.slice(0, MAX_TEMA_PREVIEW_BADGES);
  const extraTemasCount = Math.max(
    0,
    erro.temas.length - MAX_TEMA_PREVIEW_BADGES
  );

  return (
    <article
      id={`caderno-erro-row-${erro.id}`}
      className={cn(
        'scroll-mt-20 overflow-x-clip rounded-2xl border border-border bg-card shadow-sm transition-colors hover:border-slate-300 dark:hover:border-slate-700',
        showHelpHighlight && 'border-l-2 border-l-amber-500/80'
      )}
    >
      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <button
          type="button"
          onClick={() => onToggleExpand(erro.id)}
          aria-expanded={isExpanded}
          aria-controls={`caderno-erro-drawer-${erro.id}`}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn(
              'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              isExpanded && 'rotate-90 text-foreground'
            )}
            strokeWidth={1.75}
          />

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {showSeparateCodigoBadge ? (
                <span className="shrink-0 rounded-md border border-border bg-muted/70 px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                  {normalizedCodigo}
                </span>
              ) : null}

              <h2
                className={cn(
                  'min-w-0 max-w-full truncate text-base font-semibold tracking-tight text-foreground',
                  useMonoTitle && 'font-mono'
                )}
              >
                {erro.titulo}
              </h2>

              {showHelpHighlight ? (
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-amber-600 dark:text-amber-400">
                  <LifeBuoy className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Revisado com apoio</span>
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge
                variant="outline"
                className="shrink-0 whitespace-nowrap font-normal"
              >
                {ERRO_ORIGEM_LABELS[erro.origem]}
              </Badge>

              {visibleTemas.map((tema) => (
                <Badge
                  key={tema.id}
                  variant="secondary"
                  className="max-w-[140px] truncate font-normal"
                >
                  {tema.nome}
                </Badge>
              ))}

              {extraTemasCount > 0 ? (
                <Badge
                  variant="outline"
                  className="shrink-0 whitespace-nowrap font-normal tabular-nums"
                >
                  +{extraTemasCount}
                </Badge>
              ) : null}
            </div>
          </div>
        </button>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 pl-7 lg:justify-end lg:pl-0">
          <div className="flex flex-wrap items-center gap-2">
            {erro.status === 'PENDENTE' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => onRevisar(erro.id, 'SOLO')}
                  className="gap-1.5 border-emerald-500/25 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  {activeReviewMode === 'SOLO' ? (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      strokeWidth={1.75}
                    />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  )}
                  <span>Finalizado Sozinho</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => onRevisar(erro.id, 'HELP')}
                  className="gap-1.5 border-amber-500/25 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                >
                  {activeReviewMode === 'HELP' ? (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      strokeWidth={1.75}
                    />
                  ) : (
                    <LifeBuoy className="h-3.5 w-3.5" strokeWidth={1.75} />
                  )}
                  <span>Com Ajuda</span>
                </Button>
              </>
            ) : (
              <>
                {isSoloReviewed ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0"
                      strokeWidth={1.75}
                    />
                    <span>
                      {erro.lastReviewedAt
                        ? `Revisado em ${formatLocalDate(erro.lastReviewedAt)}`
                        : 'Revisado sozinho'}
                    </span>
                  </span>
                ) : null}

                {showHelpHighlight ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => onRevisar(erro.id, 'SOLO')}
                    className="gap-1.5 border-emerald-500/25 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                  >
                    {activeReviewMode === 'SOLO' ? (
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        strokeWidth={1.75}
                      />
                    ) : (
                      <CheckCircle2
                        className="h-3.5 w-3.5"
                        strokeWidth={1.75}
                      />
                    )}
                    <span>Finalizado Sozinho</span>
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => onDevolver(erro.id)}
                  className="gap-1.5"
                >
                  {isDevolving ? (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      strokeWidth={1.75}
                    />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                  )}
                  <span>Devolver para Pendentes</span>
                </Button>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isBusy}
              onClick={() => onEdit(erro)}
              aria-label={`Editar erro ${erro.titulo}`}
              title={`Editar erro ${erro.titulo}`}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.75} />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isBusy}
              onClick={() => onDelete(erro)}
              aria-label={`Excluir erro ${erro.titulo}`}
              title={`Excluir erro ${erro.titulo}`}
              className="h-8 w-8 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </div>
        </div>
      </div>

      {isExpanded ? (
        <div id={`caderno-erro-drawer-${erro.id}`}>
          <CadernoErroDrawerContent
            erro={erro}
            onEdit={onEdit}
            onCollapse={() => onToggleExpand(erro.id)}
          />
        </div>
      ) : null}
    </article>
  );
}
