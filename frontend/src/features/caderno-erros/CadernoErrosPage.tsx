import { useCallback, useEffect, useMemo, useState } from 'react';
import { UuidSchema } from '@shared/schemas/common.schema';
import { ERROR_CODES } from '@shared/types/api.types';
import type {
  CadernoErroDto,
  CadernoErroSortBy,
} from '@shared/types/caderno-erros.types';
import type {
  ErroOrigem,
  ErroStatus,
  ReviewMode,
} from '@shared/types/enums.types';
import type { TemaSummaryDto } from '@shared/types/temas.types';
import {
  AlertCircle,
  ArrowUpDown,
  BookOpen,
  BookX,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CadernoErroFormDialog } from '@/features/caderno-erros/components/CadernoErroFormDialog';
import { CadernoErroRowAccordion } from '@/features/caderno-erros/components/CadernoErroRowAccordion';
import {
  useCadernoErrosListQuery,
  useDeleteCadernoErroMutation,
  useDevolverCadernoErroMutation,
  useRevisarCadernoErroMutation,
} from '@/features/caderno-erros/hooks/useCadernoErros';
import {
  useTemaDetailQuery,
  useTemasOptionsQuery,
} from '@/features/temas-revisao/hooks/useTemas';
import { toTemaSummary } from '@/features/temas-revisao/utils/reflexoes';
import { ApiClientError, getErrorMessage } from '@/lib/errorMessages';
import { cn } from '@/lib/utils';

const PAGE_LIMIT = 20;
const ALL_FILTER_VALUE = '__all__';

const ORIGEM_FILTER_OPTIONS: ReadonlyArray<{
  label: string;
  value: ErroOrigem;
}> = [
  { label: 'Simulado', value: 'SIMULADO' },
  { label: 'Questão Externa', value: 'EXTERNAL_LINK' },
  { label: 'Questão Genérica', value: 'GENERIC_FULL' },
];

const SORT_OPTIONS: ReadonlyArray<{ label: string; value: CadernoErroSortBy }> =
  [
    { label: 'Mais recentes', value: 'recent' },
    { label: 'Mais antigos', value: 'oldest' },
  ];

interface ActiveRowAction {
  id: string;
  type: ReviewMode | 'DEVOLVER';
}

function CadernoErrosListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1, 2, 3, 4].map((index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Skeleton className="mt-1 h-4 w-4 shrink-0 rounded" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-60 max-w-full" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-24 rounded-lg" />
                <Skeleton className="h-5 w-20 rounded-lg" />
                <Skeleton className="h-5 w-24 rounded-lg" />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 lg:pl-0">
            <Skeleton className="h-8 w-36 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-xl" />
            <Skeleton className="h-8 w-8 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CadernoErrosPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTemaParam = searchParams.get('temaId');
  const parsedTemaParam = useMemo(
    () => (rawTemaParam ? UuidSchema.safeParse(rawTemaParam) : null),
    [rawTemaParam]
  );
  const validTemaId =
    parsedTemaParam && parsedTemaParam.success
      ? parsedTemaParam.data
      : undefined;

  // Limpa silenciosamente ?temaId inválido vindo na URL
  useEffect(() => {
    if (rawTemaParam !== null && parsedTemaParam && !parsedTemaParam.success) {
      const next = new URLSearchParams(searchParams);
      next.delete('temaId');
      setSearchParams(next, { replace: true });
    }
  }, [rawTemaParam, parsedTemaParam, searchParams, setSearchParams]);

  const [statusTab, setStatusTab] = useState<ErroStatus>('PENDENTE');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [origemFilter, setOrigemFilter] = useState<ErroOrigem | undefined>(
    undefined
  );
  const [sortBy, setSortBy] = useState<CadernoErroSortBy>('recent');
  const [page, setPage] = useState(1);

  const [expandedErroIds, setExpandedErroIds] = useState<Set<string>>(
    () => new Set()
  );
  const [activeRowAction, setActiveRowAction] =
    useState<ActiveRowAction | null>(null);

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingErro, setEditingErro] = useState<CadernoErroDto | null>(null);
  const [deletingErro, setDeletingErro] = useState<CadernoErroDto | null>(null);

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

  // Ao navegar via ?temaId, volta para página 1
  useEffect(() => {
    setPage(1);
  }, [validTemaId]);

  const listQuery = useCadernoErrosListQuery({
    page,
    limit: PAGE_LIMIT,
    status: statusTab,
    temaId: validTemaId,
    origem: origemFilter,
    search: debouncedSearch || undefined,
    sortBy,
  });

  const temasOptionsQuery = useTemasOptionsQuery('', true);

  const resolvedTemaFromOptionsOrList = useMemo<TemaSummaryDto | null>(() => {
    if (!validTemaId) {
      return null;
    }

    const fromOptions = temasOptionsQuery.data?.items.find(
      (item) => item.id === validTemaId
    );
    if (fromOptions) {
      return toTemaSummary(fromOptions);
    }

    const items = listQuery.data?.items ?? [];
    for (const item of items) {
      const matched = item.temas.find((tema) => tema.id === validTemaId);
      if (matched) {
        return matched;
      }
    }

    return null;
  }, [validTemaId, temasOptionsQuery.data?.items, listQuery.data?.items]);

  const shouldFetchFallbackTema = Boolean(
    validTemaId &&
      !resolvedTemaFromOptionsOrList &&
      !temasOptionsQuery.isPending
  );

  const fallbackTemaDetailQuery = useTemaDetailQuery(
    validTemaId ?? '',
    shouldFetchFallbackTema
  );

  // Caso o ?temaId aponte para um tema inexistente/excluído, limpa o filtro silenciosamente
  useEffect(() => {
    if (
      validTemaId &&
      fallbackTemaDetailQuery.isError &&
      fallbackTemaDetailQuery.error instanceof ApiClientError &&
      fallbackTemaDetailQuery.error.code === ERROR_CODES.TEMA_NOT_FOUND
    ) {
      const next = new URLSearchParams(searchParams);
      next.delete('temaId');
      setSearchParams(next, { replace: true });
    }
  }, [
    validTemaId,
    fallbackTemaDetailQuery.isError,
    fallbackTemaDetailQuery.error,
    searchParams,
    setSearchParams,
  ]);

  const activeFilterTema = useMemo<TemaSummaryDto | null>(() => {
    if (!validTemaId) {
      return null;
    }
    if (resolvedTemaFromOptionsOrList) {
      return resolvedTemaFromOptionsOrList;
    }
    if (fallbackTemaDetailQuery.data) {
      return toTemaSummary(fallbackTemaDetailQuery.data);
    }
    return null;
  }, [
    validTemaId,
    resolvedTemaFromOptionsOrList,
    fallbackTemaDetailQuery.data,
  ]);

  const temaFilterOptions = useMemo<TemaSummaryDto[]>(() => {
    const map = new Map<string, TemaSummaryDto>();
    for (const item of temasOptionsQuery.data?.items ?? []) {
      map.set(item.id, toTemaSummary(item));
    }
    if (activeFilterTema && !map.has(activeFilterTema.id)) {
      map.set(activeFilterTema.id, activeFilterTema);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR')
    );
  }, [temasOptionsQuery.data?.items, activeFilterTema]);

  const revisarMutation = useRevisarCadernoErroMutation();
  const devolverMutation = useDevolverCadernoErroMutation();
  const deleteMutation = useDeleteCadernoErroMutation();

  const items = listQuery.data?.items ?? [];
  const pagination = listQuery.data?.pagination;

  // Corrige página atual caso uma mutação esvazie a última página
  useEffect(() => {
    if (pagination && pagination.totalPages > 0 && page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [pagination, page]);

  const handleToggleExpand = useCallback((erroId: string) => {
    setExpandedErroIds((prev) => {
      const next = new Set(prev);
      if (next.has(erroId)) {
        next.delete(erroId);
      } else {
        next.add(erroId);
      }
      return next;
    });
  }, []);

  const handleTemaFilterChange = useCallback(
    (nextValue: string) => {
      const next = new URLSearchParams(searchParams);
      if (nextValue === ALL_FILTER_VALUE) {
        next.delete('temaId');
      } else {
        next.set('temaId', nextValue);
      }
      setSearchParams(next, { replace: true });
      setPage(1);
    },
    [searchParams, setSearchParams]
  );

  function handleClearFilters(): void {
    setSearchInput('');
    setDebouncedSearch('');
    setOrigemFilter(undefined);
    setSortBy('recent');
    setPage(1);

    if (searchParams.has('temaId')) {
      const next = new URLSearchParams(searchParams);
      next.delete('temaId');
      setSearchParams(next, { replace: true });
    }
  }

  function openCreateManualErro(): void {
    setEditingErro(null);
    setFormDialogOpen(true);
  }

  function openEditErro(erro: CadernoErroDto): void {
    setEditingErro(erro);
    setFormDialogOpen(true);
  }

  async function handleRevisar(id: string, reviewMode: ReviewMode): Promise<void> {
    setActiveRowAction({ id, type: reviewMode });
    try {
      await revisarMutation.mutateAsync({ id, input: { reviewMode } });
    } catch {
      // Erro tratado via toast no hook.
    } finally {
      setActiveRowAction(null);
    }
  }

  async function handleDevolver(id: string): Promise<void> {
    setActiveRowAction({ id, type: 'DEVOLVER' });
    try {
      await devolverMutation.mutateAsync(id);
    } catch {
      // Erro tratado via toast no hook.
    } finally {
      setActiveRowAction(null);
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deletingErro) {
      return;
    }

    const targetId = deletingErro.id;
    try {
      await deleteMutation.mutateAsync(targetId);
      setExpandedErroIds((prev) => {
        if (!prev.has(targetId)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      setDeletingErro(null);
    } catch {
      // Erro tratado via toast no hook.
    }
  }

  const hasActiveFilters =
    debouncedSearch.length > 0 ||
    origemFilter !== undefined ||
    validTemaId !== undefined;

  const hasCustomControls =
    searchInput.trim().length > 0 ||
    debouncedSearch.length > 0 ||
    origemFilter !== undefined ||
    validTemaId !== undefined ||
    sortBy !== 'recent';

  const isSearchPending = searchInput.trim() !== debouncedSearch;
  const isUpdatingList = listQuery.isFetching || isSearchPending;
  const showSkeleton =
    listQuery.isPending || (listQuery.isPlaceholderData && items.length === 0);

  // Evita exibir UUID bruto no SelectValue caso ?temaId venha via deep-link e o nome ainda esteja resolvendo
  const temaSelectValue =
    validTemaId === undefined
      ? ALL_FILTER_VALUE
      : activeFilterTema
        ? validTemaId
        : '';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2.5">
            <BookX
              className="h-5 w-5 shrink-0 text-primary"
              strokeWidth={1.75}
            />
            <h1 className="text-2xl font-bold tracking-tight">
              Caderno de Erros
            </h1>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Revise questões pendentes, promova revisões feitas com apoio e
            registre erros externos ou genéricos.
          </p>
        </div>

        <Button
          type="button"
          variant="default"
          onClick={openCreateManualErro}
          className="w-full shrink-0 gap-2 sm:w-auto"
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>Registrar Erro Manual</span>
        </Button>
      </header>

      <Tabs
        value={statusTab}
        onValueChange={(value) => {
          if (value === 'PENDENTE' || value === 'REVISADO') {
            setStatusTab(value);
            setPage(1);
          }
        }}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
            <TabsTrigger value="PENDENTE" className="gap-2">
              <Clock className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span>Pendentes</span>
            </TabsTrigger>
            <TabsTrigger value="REVISADO" className="gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span>Já Revisados</span>
            </TabsTrigger>
          </TabsList>

          {activeFilterTema ? (
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:justify-start">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <BookOpen
                  className="h-3.5 w-3.5 shrink-0 text-primary"
                  strokeWidth={1.75}
                />
                <span className="shrink-0">Tema:</span>
                <strong className="truncate font-semibold text-foreground">
                  {activeFilterTema.nome}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => handleTemaFilterChange(ALL_FILTER_VALUE)}
                aria-label={`Remover filtro do tema ${activeFilterTema.nome}`}
                className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          ) : null}
        </div>

        <section
          aria-label="Filtros e ordenação do caderno de erros"
          className="relative overflow-hidden rounded-2xl border border-border bg-card p-3 sm:p-4"
        >
          <ListUpdatingTopBar isUpdating={isUpdatingList} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
            <div className="relative min-w-0 sm:col-span-2 xl:col-span-4">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.75}
              />
              <Input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar por título, código, enunciado ou observação..."
                aria-label="Buscar registros no caderno de erros"
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

            <div className="min-w-0 xl:col-span-3">
              <Select
                value={origemFilter ?? ALL_FILTER_VALUE}
                onValueChange={(value) => {
                  if (value === ALL_FILTER_VALUE) {
                    setOrigemFilter(undefined);
                    setPage(1);
                    return;
                  }
                  const matched = ORIGEM_FILTER_OPTIONS.find(
                    (option) => option.value === value
                  );
                  if (matched) {
                    setOrigemFilter(matched.value);
                    setPage(1);
                  }
                }}
              >
                <SelectTrigger aria-label="Filtrar por origem" className="w-full">
                  <div className="flex min-w-0 items-center gap-2">
                    <Filter
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      strokeWidth={1.75}
                    />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>
                    Todas as origens
                  </SelectItem>
                  {ORIGEM_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 xl:col-span-3">
              <Select
                value={temaSelectValue}
                onValueChange={handleTemaFilterChange}
              >
                <SelectTrigger aria-label="Filtrar por tema" className="w-full">
                  <div className="flex min-w-0 items-center gap-2">
                    <BookOpen
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      strokeWidth={1.75}
                    />
                    <SelectValue
                      placeholder={
                        validTemaId ? 'Filtrando por tema' : 'Todos os temas'
                      }
                    />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  <SelectItem value={ALL_FILTER_VALUE}>
                    Todos os temas
                  </SelectItem>
                  {temaFilterOptions.map((tema) => (
                    <SelectItem
                      key={tema.id}
                      value={tema.id}
                      title={tema.nome}
                      className="[&>span:last-child]:min-w-0 [&>span:last-child]:truncate"
                    >
                      {tema.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 sm:col-span-2 xl:col-span-2">
              <Select
                value={sortBy}
                onValueChange={(value) => {
                  const matched = SORT_OPTIONS.find(
                    (option) => option.value === value
                  );
                  if (matched) {
                    setSortBy(matched.value);
                    setPage(1);
                  }
                }}
              >
                <SelectTrigger
                  aria-label="Ordenar registros do caderno de erros"
                  className="w-full"
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
                            ? 'registro encontrado'
                            : 'registro'
                          : hasActiveFilters
                            ? 'registros encontrados'
                            : 'registros'
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
          <CadernoErrosListSkeleton />
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
              <BookX className="h-5 w-5" strokeWidth={1.75} />
            </div>

            <h2 className="text-base font-semibold text-foreground">
              {hasActiveFilters
                ? 'Nenhum erro encontrado com os filtros atuais'
                : statusTab === 'PENDENTE'
                  ? 'Nenhum erro pendente no momento'
                  : 'Nenhum erro revisado ainda'}
            </h2>

            <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
              {hasActiveFilters
                ? 'Ajuste a busca, origem ou tema selecionado, ou limpe os filtros para visualizar outros registros.'
                : statusTab === 'PENDENTE'
                  ? 'Questões marcadas como Parcial ou Errei em simulados e registros manuais aparecem aqui para revisão.'
                  : 'Ao concluir uma revisão na aba Pendentes como Finalizado Sozinho ou Com Ajuda, o registro vem para cá e atualiza os temas vinculados.'}
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
              ) : statusTab === 'PENDENTE' ? (
                <Button
                  type="button"
                  onClick={openCreateManualErro}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                  <span>Registrar Erro Manual</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStatusTab('PENDENTE');
                    setPage(1);
                  }}
                >
                  Ver Pendentes
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
              {items.map((erro) => {
                const isRowMutating = activeRowAction?.id === erro.id;
                const activeReviewMode =
                  isRowMutating &&
                  (activeRowAction.type === 'SOLO' ||
                    activeRowAction.type === 'HELP')
                    ? activeRowAction.type
                    : null;
                const isDevolving =
                  isRowMutating && activeRowAction.type === 'DEVOLVER';

                return (
                  <CadernoErroRowAccordion
                    key={erro.id}
                    erro={erro}
                    isExpanded={expandedErroIds.has(erro.id)}
                    activeReviewMode={activeReviewMode}
                    isDevolving={isDevolving}
                    onToggleExpand={handleToggleExpand}
                    onRevisar={handleRevisar}
                    onDevolver={handleDevolver}
                    onEdit={openEditErro}
                    onDelete={setDeletingErro}
                  />
                );
              })}
            </div>

            {pagination && pagination.totalPages > 0 ? (
              <nav
                aria-label="Paginação do caderno de erros"
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-xs text-muted-foreground tabular-nums">
                  Página{' '}
                  <strong className="text-foreground">{pagination.page}</strong>{' '}
                  de{' '}
                  <strong className="text-foreground">
                    {pagination.totalPages}
                  </strong>{' '}
                  ({pagination.total}{' '}
                  {pagination.total === 1 ? 'registro' : 'registros'})
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
                      pagination.page >= pagination.totalPages ||
                      isUpdatingList
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
      </Tabs>

      <CadernoErroFormDialog
        open={formDialogOpen}
        onOpenChange={(nextOpen) => {
          setFormDialogOpen(nextOpen);
          if (!nextOpen) {
            setEditingErro(null);
          }
        }}
        editingErro={editingErro}
        defaultTema={activeFilterTema}
      />

      <AlertDialog
        open={deletingErro !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteMutation.isPending) {
            setDeletingErro(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro do Caderno de Erros?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro{' '}
              <strong className="font-semibold text-foreground">
                {deletingErro?.titulo}
              </strong>{' '}
              será removido permanentemente do seu Caderno de Erros. Os temas
              vinculados e seus históricos de revisão não serão alterados. Essa
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Excluindo...</span>
                </>
              ) : (
                <span>Excluir registro</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
