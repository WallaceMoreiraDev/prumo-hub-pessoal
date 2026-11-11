import type { ReflexaoDto, TemaSummaryDto } from '@shared/types/temas.types';
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
  BookX,
  GitCompareArrows,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { MarkdownMathRenderer } from '@/components/markdown/MarkdownMathRenderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTemaDetailQuery } from '@/features/temas-revisao/hooks/useTemas';
import {
  getConnectedPeerThemes,
  toTemaSummary,
} from '@/features/temas-revisao/utils/reflexoes';
import { formatLocalDateTime } from '@/lib/date';
import { getErrorMessage } from '@/lib/errorMessages';

export interface TemaDrawerContentProps {
  temaId: string;
  temaNome: string;
  isExpanded: boolean;
  onAddReflexao: (temaPrincipal: TemaSummaryDto) => void;
  onAddConexao: (temaPrincipal: TemaSummaryDto) => void;
  onEditReflexao: (reflexao: ReflexaoDto) => void;
  onDeleteReflexao: (reflexao: ReflexaoDto) => void;
  onNavigateToTema: (targetTema: TemaSummaryDto) => void;
}

export function TemaDrawerContent({
  temaId,
  temaNome,
  isExpanded,
  onAddReflexao,
  onAddConexao,
  onEditReflexao,
  onDeleteReflexao,
  onNavigateToTema,
}: TemaDrawerContentProps) {
  const detailQuery = useTemaDetailQuery(temaId, isExpanded);

  if (detailQuery.isPending) {
    return (
      <div className="animate-accordion-down border-t border-border bg-muted/30 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        </div>
        <Skeleton className="mt-5 h-12 w-full rounded-xl" />
      </div>
    );
  }

  if (detailQuery.isError) {
    return (
      <div className="animate-accordion-down border-t border-border bg-muted/30 p-4 sm:p-5">
        <div className="flex flex-col gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5 text-sm text-rose-600 dark:text-rose-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <p className="min-w-0 break-words leading-relaxed">
              {getErrorMessage(detailQuery.error)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void detailQuery.refetch()}
            className="shrink-0 gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Tentar novamente</span>
          </Button>
        </div>
      </div>
    );
  }

  const detalhe = detailQuery.data;
  const temaSummary = toTemaSummary(detalhe);

  return (
    <div className="animate-accordion-down border-t border-border bg-muted/30 p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section aria-label="Reflexões Próprias" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <MessageSquareText
                className="h-4 w-4 shrink-0 text-primary"
                strokeWidth={1.75}
              />
              <h3 className="truncate text-sm font-semibold text-foreground">
                Reflexões Próprias
              </h3>
              <Badge variant="secondary" className="shrink-0 tabular-nums">
                {detalhe.reflexoesProprias.length}
              </Badge>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddReflexao(temaSummary)}
              className="shrink-0 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Nova reflexão</span>
            </Button>
          </div>

          {detalhe.reflexoesProprias.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-xs leading-relaxed text-muted-foreground">
              Nenhuma reflexão própria registrada para este tema.
            </div>
          ) : (
            <div className="space-y-3">
              {detalhe.reflexoesProprias.map((reflexao) => (
                <article
                  key={reflexao.id}
                  className="space-y-2.5 rounded-xl border border-border bg-card p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                      {formatLocalDateTime(reflexao.updatedAt)}
                    </span>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onEditReflexao(reflexao)}
                        aria-label="Editar reflexão"
                        title="Editar reflexão"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteReflexao(reflexao)}
                        aria-label="Excluir reflexão"
                        title="Excluir reflexão"
                        className="h-7 w-7 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </div>

                  <MarkdownMathRenderer content={reflexao.conteudo} />
                </article>
              ))}
            </div>
          )}
        </section>

        <section
          aria-label="Conexões com Outros Temas"
          className="min-w-0 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <GitCompareArrows
                className="h-4 w-4 shrink-0 text-primary"
                strokeWidth={1.75}
              />
              <h3 className="truncate text-sm font-semibold text-foreground">
                Conexões com Outros Temas
              </h3>
              <Badge variant="secondary" className="shrink-0 tabular-nums">
                {detalhe.conexoes.length}
              </Badge>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddConexao(temaSummary)}
              className="shrink-0 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Conectar tema</span>
            </Button>
          </div>

          {detalhe.conexoes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-xs leading-relaxed text-muted-foreground">
              Nenhuma conexão bidirecional vinculada a este tema.
            </div>
          ) : (
            <div className="space-y-3">
              {detalhe.conexoes.map((conexao) => {
                const peers = getConnectedPeerThemes(conexao, temaId);

                return (
                  <article
                    key={conexao.id}
                    className="space-y-2.5 rounded-xl border border-border bg-card p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                        {peers.map((peer) => (
                          <button
                            key={peer.id}
                            type="button"
                            onClick={() => onNavigateToTema(peer)}
                            title={`Abrir tema ${peer.nome}`}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-secondary/70 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="min-w-0 truncate">{temaNome}</span>
                            <ArrowLeftRight
                              className="h-3 w-3 shrink-0 text-muted-foreground"
                              strokeWidth={1.75}
                            />
                            <span className="min-w-0 truncate">{peer.nome}</span>
                          </button>
                        ))}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditReflexao(conexao)}
                          aria-label="Editar conexão"
                          title="Editar conexão"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteReflexao(conexao)}
                          aria-label="Excluir conexão"
                          title="Excluir conexão"
                          className="h-7 w-7 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </Button>
                      </div>
                    </div>

                    <MarkdownMathRenderer content={conexao.conteudo} />

                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="min-w-0 max-w-full truncate">
                        Origem: {conexao.temaPrincipal.nome}
                      </span>
                      <span className="shrink-0 whitespace-nowrap">
                        {formatLocalDateTime(conexao.updatedAt)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <footer className="mt-5 flex flex-col gap-3 rounded-xl border border-border bg-card/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <BookX className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
            <span>Caderno de Erros do tema:</span>
          </div>

          <Badge
            variant={detalhe.totalErrosPendentes > 0 ? 'warning' : 'secondary'}
            className="shrink-0 whitespace-nowrap tabular-nums"
          >
            {detalhe.totalErrosPendentes}{' '}
            {detalhe.totalErrosPendentes === 1 ? 'pendente' : 'pendentes'}
          </Badge>

          <Badge
            variant="secondary"
            className="shrink-0 whitespace-nowrap tabular-nums"
          >
            {detalhe.totalErrosRevisados}{' '}
            {detalhe.totalErrosRevisados === 1 ? 'revisado' : 'revisados'}
          </Badge>
        </div>

        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-full shrink-0 gap-1.5 sm:w-auto"
        >
          <Link to={`/caderno-erros?temaId=${encodeURIComponent(temaId)}`}>
            <span>Ver erros deste tema</span>
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Link>
        </Button>
      </footer>
    </div>
  );
}
