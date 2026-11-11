import { useCallback, useEffect, useState } from 'react';
import type { ReviewMode } from '@shared/types/enums.types';
import type {
  ReflexaoDto,
  TemaListItemDto,
  TemaSortBy,
  TemaSummaryDto,
} from '@shared/types/temas.types';
import {
  AlertCircle,
  ArrowUpDown,
  BookOpen,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  ListUpdatingStatus,
  ListUpdatingTopBar,
  SearchUpdatingSpinner,
  getSearchInputPaddingClass,
} from '@/components/layout/ListFilterFeedback';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { RegistrarPraticaDialog } from '@/features/temas-revisao/components/RegistrarPraticaDialog';
import { ReflexaoFormDialog } from '@/features/temas-revisao/components/ReflexaoFormDialog';
import { TemaFormDialog } from '@/features/temas-revisao/components/TemaFormDialog';
import { TemaRowAccordion } from '@/features/temas-revisao/components/TemaRowAccordion';
import {
  useDeleteReflexaoMutation,
  useDeleteTemaMutation,
  useTemasListQuery,
} from '@/features/temas-revisao/hooks/useTemas';
import { getErrorMessage } from '@/lib/errorMessages';
import { cn } from '@/lib/utils';

const PAGE_LIMIT = 20;

const REVIEW_MODE_OPTIONS: ReadonlyArray<{
  label: string;
  value: ReviewMode | undefined;
}> = [
  { label: 'Todos', value: undefined },
  { label: 'Sozinho', value: 'SOLO' },
  { label: 'Com Ajuda', value: 'HELP' },
];

const SORT_OPTIONS: ReadonlyArray<{ label: string; value: TemaSortBy }> = [
  { label: 'Mais tempo sem revisar', value: 'oldest_review' },
  { label: 'Revisados recentemente', value: 'recent_review' },
  { label: 'Ordem alfabética (A–Z)', value: 'name_asc' },
];

function TemasListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1, 2, 3, 4].map((index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Skeleton className="mt-1 h-4 w-4 shrink-0 rounded" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-48 max-w-full" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20 rounded-lg" />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
            <Skeleton className="h-6 w-28 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-xl" />
            <Skeleton className="h-8 w-8 rounded-xl" />
            <Skeleton className="h-8 w-8 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TemasRevisaoPage() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [reviewModeFilter, setReviewModeFilter] = useState<
    ReviewMode | undefined
  >(undefined);
  const [sortBy, setSortBy] = useState<TemaSortBy>('oldest_review');
  const [page, setPage] = useState(1);
  const [expandedTemaIds, setExpandedTemaIds] = useState<Set<string>>(
    () => new Set()
  );
  const [pendingFocusTemaId, setPendingFocusTemaId] = useState<string | null>(
    null
  );

  // Estados de modais e confirmações
  const [temaDialogOpen, setTemaDialogOpen] = useState(false);
  const [editingTema, setEditingTema] = useState<TemaListItemDto | null>(null);

  const [praticaDialogOpen, setPraticaDialogOpen] = useState(false);
  const [praticaInitialTemas, setPraticaInitialTemas] = useState<
    TemaSummaryDto[]
  >([]);

  const [reflexaoDialogOpen, setReflexaoDialogOpen] = useState(false);
  const [editingReflexao, setEditingReflexao] = useState<ReflexaoDto | null>(
    null
  );
  const [reflexaoDefaultPrincipal, setReflexaoDefaultPrincipal] =
    useState<TemaSummaryDto | null>(null);
  const [reflexaoFocusConnected, setReflexaoFocusConnected] = useState(false);

  const [deletingTema, setDeletingTema] = useState<TemaListItemDto | null>(
    null
  );
  const [deletingReflexao, setDeletingReflexao] = useState<ReflexaoDto | null>(
    null
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch((prev) => {
        const next = searchInput.trim();
        if (prev !== next) {
          setPage(1);
        }
        return next;
      });
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  const listQuery = useTemasListQuery({
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch || undefined,
    sortBy,
    reviewMode: reviewModeFilter,
  });

  const deleteTemaMutation = useDeleteTemaMutation();
  const deleteReflexaoMutation = useDeleteReflexaoMutation();

  useEffect(() => {
    if (!pendingFocusTemaId) {
      return;
    }

    const items = listQuery.data?.items ?? [];
    const found = items.some((item) => item.id === pendingFocusTemaId);

    if (found) {
      const targetId = pendingFocusTemaId;
      setExpandedTemaIds((prev) => {
        if (prev.has(targetId)) {
          return prev;
        }
        const next = new Set(prev);
        next.add(targetId);
        return next;
      });
      setPendingFocusTemaId(null);

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const element = document.getElementById(`tema-row-${targetId}`);
          element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
      return;
    }

    if (!listQuery.isFetching) {
      setPendingFocusTemaId(null);
    }
  }, [pendingFocusTemaId, listQuery.data?.items, listQuery.isFetching]);

  const handleToggleExpand = useCallback((temaId: string) => {
    setExpandedTemaIds((prev) => {
      const next = new Set(prev);
      if (next.has(temaId)) {
        next.delete(temaId);
      } else {
        next.add(temaId);
      }
      return next;
    });
  }, []);

  const handleNavigateToTema = useCallback(
    (targetTema: TemaSummaryDto) => {
      const items = listQuery.data?.items ?? [];
      const isVisibleInCurrentPage = items.some(
        (item) => item.id === targetTema.id
      );

      if (isVisibleInCurrentPage) {
        setExpandedTemaIds((prev) => {
          const next = new Set(prev);
          next.add(targetTema.id);
          return next;
        });
        setPendingFocusTemaId(targetTema.id);
        return;
      }

      setSearchInput(targetTema.nome);
      setDebouncedSearch(targetTema.nome);
      setReviewModeFilter(undefined);
      setPage(1);
      setPendingFocusTemaId(targetTema.id);
    },
    [listQuery.data?.items]
  );

  function openCreateTema(): void {
    setEditingTema(null);
    setTemaDialogOpen(true);
  }

  function openEditTema(tema: TemaListItemDto): void {
    setEditingTema(tema);
    setTemaDialogOpen(true);
  }

  function openRegistrarPratica(initialTemas: TemaSummaryDto[] = []): void {
    setPraticaInitialTemas(initialTemas);
    setPraticaDialogOpen(true);
  }

  function openCreateReflexao(options?: {
    defaultPrincipal?: TemaSummaryDto;
    focusConnected?: boolean;
  }): void {
    setEditingReflexao(null);
    setReflexaoDefaultPrincipal(options?.defaultPrincipal ?? null);
    setReflexaoFocusConnected(options?.focusConnected ?? false);
    setReflexaoDialogOpen(true);
  }

  function openEditReflexao(reflexao: ReflexaoDto): void {
    setEditingReflexao(reflexao);
    setReflexaoDefaultPrincipal(null);
    setReflexaoFocusConnected(false);
    setReflexaoDialogOpen(true);
  }

  function handleClearFilters(): void {
    setSearchInput('');
    setDebouncedSearch('');
    setReviewModeFilter(undefined);
    setSortBy('oldest_review');
    setPage(1);
  }

  async function handleConfirmDeleteTema(): Promise<void> {
    if (!deletingTema) {
      return;
    }

    const targetId = deletingTema.id;
    try {
      await deleteTemaMutation.mutateAsync(targetId);
      setExpandedTemaIds((prev) => {
        if (!prev.has(targetId)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      setDeletingTema(null);
    } catch {
      // Erro já notificado via toast no hook.
    }
  }

  async function handleConfirmDeleteReflexao(): Promise<void> {
    if (!deletingReflexao) {
      return;
    }

    try {
      await deleteReflexaoMutation.mutateAsync(deletingReflexao.id);
      setDeletingReflexao(null);
    } catch {
      // Erro já notificado via toast no hook.
    }
  }

  const hasActiveFilters =
    debouncedSearch.length > 0 || reviewModeFilter !== undefined;
  const hasCustomControls =
    searchInput.trim().length > 0 ||
    debouncedSearch.length > 0 ||
    reviewModeFilter !== undefined ||
    sortBy !== 'oldest_review';
  const items = listQuery.data?.items ?? [];
  const pagination = listQuery.data?.pagination;

  const isSearchPending = searchInput.trim() !== debouncedSearch;
  const isUpdatingList = listQuery.isFetching || isSearchPending;
  const showSkeleton =
    listQuery.isPending || (listQuery.isPlaceholderData && items.length === 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2.5">
            <BookOpen
              className="h-5 w-5 shrink-0 text-primary"
              strokeWidth={1.75}
            />
            <h1 className="text-2xl font-bold tracking-tight">
              Temas e Revisão
            </h1>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Radar de revisão por tema, reflexões próprias e conexões
            bidirecionais entre conteúdos.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={openCreateTema}
            className="w-full gap-2 sm:w-auto"
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>Novo Tema</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => openRegistrarPratica([])}
            className="w-full gap-2 sm:w-auto"
          >
            <CheckSquare className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>Registrar Prática / Revisão</span>
          </Button>

          <Button
            type="button"
            variant="default"
            onClick={() => openCreateReflexao()}
            className="w-full gap-2 sm:w-auto"
          >
            <MessageSquarePlus
              className="h-4 w-4 shrink-0"
              strokeWidth={1.75}
            />
            <span>Nova Reflexão</span>
          </Button>
        </div>
      </header>

      <section
        aria-label="Filtros e ordenação de temas"
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-3 sm:p-4"
      >
        <ListUpdatingTopBar isUpdating={isUpdatingList} />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full min-w-0 lg:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
            />
            <Input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar tema pelo nome..."
              aria-label="Buscar tema pelo nome"
              className={getSearchInputPaddingClass(
                isUpdatingList,
                searchInput.length > 0
              )}
            />
            <SearchUpdatingSpinner
              isUpdating={isUpdatingList}
              hasClearButton={searchInput.length > 0}
            />
            {searchInput.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setDebouncedSearch('');
                  setPage(1);
                }}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Última revisão:</span>
              </span>

              <div
                role="group"
                aria-label="Filtrar por modo da última revisão"
                className="inline-flex w-full rounded-xl bg-muted p-1 sm:w-auto"
              >
                {REVIEW_MODE_OPTIONS.map((option) => {
                  const isSelected = reviewModeFilter === option.value;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setReviewModeFilter(option.value);
                        setPage(1);
                      }}
                      className={cn(
                        'flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none',
                        isSelected
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Select
              value={sortBy}
              onValueChange={(value) => {
                const matchedOption = SORT_OPTIONS.find(
                  (option) => option.value === value
                );
                if (matchedOption) {
                  setSortBy(matchedOption.value);
                  setPage(1);
                }
              }}
            >
              <SelectTrigger
                aria-label="Ordenar temas"
                className="w-full sm:w-[235px]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ArrowUpDown
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasCustomControls || isUpdatingList || pagination ? (
          <div className="mt-3 flex min-h-7 flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
            {isUpdatingList ? (
              <ListUpdatingStatus />
            ) : (
              <span className="tabular-nums">
                {pagination
                  ? `${pagination.total} ${
                      pagination.total === 1
                        ? hasActiveFilters
                          ? 'tema encontrado'
                          : 'tema'
                        : hasActiveFilters
                          ? 'temas encontrados'
                          : 'temas'
                    }`
                  : 'Filtros ou ordenação ativos'}
              </span>
            )}

            {hasCustomControls ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Limpar filtros</span>
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      {showSkeleton ? (
        <TemasListSkeleton />
      ) : listQuery.isError ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5 text-sm text-rose-600 dark:text-rose-400">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={1.75}
            />
            <p className="min-w-0 break-words leading-relaxed">
              {getErrorMessage(listQuery.error)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void listQuery.refetch()}
            className="shrink-0 gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Tentar novamente</span>
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
            <BookOpen className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <h2 className="text-base font-semibold text-foreground">
            {hasActiveFilters
              ? 'Nenhum tema encontrado com os filtros atuais'
              : 'Nenhum tema cadastrado ainda'}
          </h2>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
            {hasActiveFilters
              ? 'Tente ajustar o termo de busca ou limpar os filtros aplicados para visualizar seus temas.'
              : 'Crie seu primeiro tema de estudo para acompanhar o tempo sem revisar, registrar reflexões e conectar assuntos.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleClearFilters}
              >
                Limpar filtros
              </Button>
            ) : (
              <Button type="button" onClick={openCreateTema} className="gap-2">
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                <span>Criar primeiro tema</span>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            aria-busy={isUpdatingList}
            className={cn(
              'space-y-3 transition-opacity duration-150',
              isUpdatingList || listQuery.isPlaceholderData
                ? 'pointer-events-none select-none opacity-55'
                : 'opacity-100'
            )}
          >
            {items.map((tema) => (
              <TemaRowAccordion
                key={tema.id}
                tema={tema}
                isExpanded={expandedTemaIds.has(tema.id)}
                onToggleExpand={handleToggleExpand}
                onPraticar={(summary) => openRegistrarPratica([summary])}
                onEditTema={openEditTema}
                onDeleteTema={setDeletingTema}
                onAddReflexao={(principal) =>
                  openCreateReflexao({
                    defaultPrincipal: principal,
                    focusConnected: false,
                  })
                }
                onAddConexao={(principal) =>
                  openCreateReflexao({
                    defaultPrincipal: principal,
                    focusConnected: true,
                  })
                }
                onEditReflexao={openEditReflexao}
                onDeleteReflexao={setDeletingReflexao}
                onNavigateToTema={handleNavigateToTema}
              />
            ))}
          </div>

          {pagination && pagination.totalPages > 0 ? (
            <nav
              aria-label="Paginação de temas"
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-xs text-muted-foreground tabular-nums">
                Página <strong className="text-foreground">{pagination.page}</strong>{' '}
                de <strong className="text-foreground">{pagination.totalPages}</strong>{' '}
                ({pagination.total}{' '}
                {pagination.total === 1 ? 'tema' : 'temas'})
              </p>

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1 || isUpdatingList}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="gap-1.5"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
                  <span>Anterior</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    pagination.page >= pagination.totalPages || isUpdatingList
                  }
                  onClick={() => setPage((prev) => prev + 1)}
                  className="gap-1.5"
                >
                  <span>Próxima</span>
                  <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </div>
            </nav>
          ) : null}
        </div>
      )}

      <TemaFormDialog
        open={temaDialogOpen}
        onOpenChange={(nextOpen) => {
          setTemaDialogOpen(nextOpen);
          if (!nextOpen) {
            setEditingTema(null);
          }
        }}
        tema={editingTema}
      />

      <RegistrarPraticaDialog
        open={praticaDialogOpen}
        onOpenChange={(nextOpen) => {
          setPraticaDialogOpen(nextOpen);
          if (!nextOpen) {
            setPraticaInitialTemas([]);
          }
        }}
        initialTemas={praticaInitialTemas}
      />

      <ReflexaoFormDialog
        open={reflexaoDialogOpen}
        onOpenChange={(nextOpen) => {
          setReflexaoDialogOpen(nextOpen);
          if (!nextOpen) {
            setEditingReflexao(null);
            setReflexaoDefaultPrincipal(null);
            setReflexaoFocusConnected(false);
          }
        }}
        editingReflexao={editingReflexao}
        defaultTemaPrincipal={reflexaoDefaultPrincipal}
        focusConnectedSection={reflexaoFocusConnected}
      />

      <AlertDialog
        open={deletingTema !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteTemaMutation.isPending) {
            setDeletingTema(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tema?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao excluir{' '}
              <strong className="font-semibold text-foreground">
                {deletingTema?.nome}
              </strong>
              , todas as reflexões em que ele é o tema principal serão removidas
              em cascata, bem como seus vínculos em conexões, questões e erros.
              Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTemaMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteTemaMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDeleteTema();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTemaMutation.isPending ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Excluindo...</span>
                </>
              ) : (
                <span>Excluir tema</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deletingReflexao !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteReflexaoMutation.isPending) {
            setDeletingReflexao(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletingReflexao && deletingReflexao.temasConectados.length > 0
                ? 'Excluir conexão entre temas?'
                : 'Excluir reflexão?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingReflexao && deletingReflexao.temasConectados.length > 0
                ? 'Esta conexão bidirecional será removida de ambos os lados (tema principal e temas conectados). Essa ação não pode ser desfeita.'
                : 'Esta reflexão será removida permanentemente do tema. Essa ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteReflexaoMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteReflexaoMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDeleteReflexao();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteReflexaoMutation.isPending ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Excluindo...</span>
                </>
              ) : (
                <span>Excluir</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
