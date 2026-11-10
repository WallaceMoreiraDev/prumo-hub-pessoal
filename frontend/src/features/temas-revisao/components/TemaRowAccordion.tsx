import type {
  ReflexaoDto,
  TemaListItemDto,
  TemaSummaryDto,
} from '@shared/types/temas.types';
import {
  CheckCircle2,
  ChevronRight,
  GitCompareArrows,
  LifeBuoy,
  MessageSquareText,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TemaDrawerContent } from '@/features/temas-revisao/components/TemaDrawerContent';
import { toTemaSummary } from '@/features/temas-revisao/utils/reflexoes';
import { formatDaysSinceReview, formatLocalDate } from '@/lib/date';
import { cn } from '@/lib/utils';

const MAX_CONNECTED_PREVIEW_BADGES = 3;

export interface TemaRowAccordionProps {
  tema: TemaListItemDto;
  isExpanded: boolean;
  onToggleExpand: (temaId: string) => void;
  onPraticar: (tema: TemaSummaryDto) => void;
  onEditTema: (tema: TemaListItemDto) => void;
  onDeleteTema: (tema: TemaListItemDto) => void;
  onAddReflexao: (temaPrincipal: TemaSummaryDto) => void;
  onAddConexao: (temaPrincipal: TemaSummaryDto) => void;
  onEditReflexao: (reflexao: ReflexaoDto) => void;
  onDeleteReflexao: (reflexao: ReflexaoDto) => void;
  onNavigateToTema: (targetTema: TemaSummaryDto) => void;
}

export function TemaRowAccordion({
  tema,
  isExpanded,
  onToggleExpand,
  onPraticar,
  onEditTema,
  onDeleteTema,
  onAddReflexao,
  onAddConexao,
  onEditReflexao,
  onDeleteReflexao,
  onNavigateToTema,
}: TemaRowAccordionProps) {
  const isHelpMode = tema.lastReviewMode === 'HELP';
  const isSoloMode = tema.lastReviewMode === 'SOLO';
  const daysSinceReviewLabel = formatDaysSinceReview(tema.lastReviewedAt);
  const formattedReviewDate = tema.lastReviewedAt
    ? formatLocalDate(tema.lastReviewedAt)
    : null;

  const visibleConnectedTemas = tema.temasConectadosResumo.slice(
    0,
    MAX_CONNECTED_PREVIEW_BADGES
  );
  const extraConnectedCount = Math.max(
    0,
    tema.temasConectadosResumo.length - MAX_CONNECTED_PREVIEW_BADGES
  );

  return (
    <article
      id={`tema-row-${tema.id}`}
      className={cn(
        'scroll-mt-20 overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-colors hover:border-slate-300 dark:hover:border-slate-700',
        isHelpMode && 'border-l-2 border-l-amber-500/80'
      )}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => onToggleExpand(tema.id)}
          aria-expanded={isExpanded}
          aria-controls={`tema-drawer-${tema.id}`}
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
              <h2 className="min-w-0 max-w-full truncate text-base font-semibold tracking-tight text-foreground">
                {tema.nome}
              </h2>

              {isHelpMode ? (
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-amber-600 dark:text-amber-400">
                  <LifeBuoy className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Última revisão com apoio</span>
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap tabular-nums">
                <MessageSquareText className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>
                  {tema.totalReflexoes}{' '}
                  {tema.totalReflexoes === 1 ? 'reflexão' : 'reflexões'}
                </span>
              </span>

              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap tabular-nums">
                <GitCompareArrows className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>
                  {tema.totalConexoes}{' '}
                  {tema.totalConexoes === 1 ? 'conexão' : 'conexões'}
                </span>
              </span>

              {visibleConnectedTemas.map((connected) => (
                <Badge
                  key={connected.id}
                  variant="secondary"
                  className="max-w-[140px] truncate font-normal"
                >
                  {connected.nome}
                </Badge>
              ))}

              {extraConnectedCount > 0 ? (
                <Badge
                  variant="outline"
                  className="shrink-0 whitespace-nowrap font-normal tabular-nums"
                >
                  +{extraConnectedCount}
                </Badge>
              ) : null}
            </div>
          </div>
        </button>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 pl-7 sm:justify-end sm:pl-0">
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant={
                isSoloMode ? 'success' : isHelpMode ? 'warning' : 'secondary'
              }
              className="shrink-0 gap-1.5 whitespace-nowrap"
            >
              {isSoloMode ? (
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : isHelpMode ? (
                <LifeBuoy className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : null}
              <span>{daysSinceReviewLabel}</span>
            </Badge>

            {formattedReviewDate ? (
              <span className="hidden shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground md:inline">
                {formattedReviewDate}
              </span>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPraticar(toTemaSummary(tema))}
              className="gap-1.5"
            >
              <Play className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Praticar</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onEditTema(tema)}
              aria-label={`Editar tema ${tema.nome}`}
              title={`Editar tema ${tema.nome}`}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.75} />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onDeleteTema(tema)}
              aria-label={`Excluir tema ${tema.nome}`}
              title={`Excluir tema ${tema.nome}`}
              className="h-8 w-8 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </div>
        </div>
      </div>

      {isExpanded ? (
        <div id={`tema-drawer-${tema.id}`}>
          <TemaDrawerContent
            temaId={tema.id}
            temaNome={tema.nome}
            isExpanded={isExpanded}
            onAddReflexao={onAddReflexao}
            onAddConexao={onAddConexao}
            onEditReflexao={onEditReflexao}
            onDeleteReflexao={onDeleteReflexao}
            onNavigateToTema={onNavigateToTema}
          />
        </div>
      ) : null}
    </article>
  );
}
