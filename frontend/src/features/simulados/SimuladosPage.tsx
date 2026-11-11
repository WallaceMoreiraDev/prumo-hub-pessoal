import { useEffect, useState } from 'react';
import type { SimuladoStatus } from '@shared/types/enums.types';
import {
  SIMULADO_SORT_OPTIONS,
  type SimuladoListItemDto,
  type SimuladoSortBy,
} from '@shared/types/simulados.types';
import {
  AlertCircle,
  ArrowUpDown,
  BookOpenCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  ListChecks,
  Loader2,
  MessageSquareText,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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
import { Badge } from '@/components/ui/badge';
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
import { SimuladoFormDialog } from '@/features/simulados/components/SimuladoFormDialog';
import {
  useDeleteSimuladoMutation,
  useSimuladosListQuery,
} from '@/features/simulados/hooks/useSimulados';
import {
  SIMULADO_STATUS_LABELS,
  formatClockDuration,
  formatConfiguredDuration,
} from '@/features/simulados/utils/simulados';
import { formatLocalDate, formatLocalDateTime } from '@/lib/date';
import { getErrorMessage } from '@/lib/errorMessages';

const PAGE_LIMIT = 20;
type StatusTabValue = 'ALL' | SimuladoStatus;

const SORT_LABELS: Readonly<Record<SimuladoSortBy, string>> = {
  recent: 'Mais recentes',
  oldest: 'Mais antigos',
};

function getStatusBadgeVariant(
  status: SimuladoStatus
): 'secondary' | 'default' | 'success' {
  switch (status) {
    case 'EM_ANDAMENTO':
      return 'default';
    case 'FINALIZADO':
      return 'success';
    case 'PREPARACAO':
    default:
      return 'secondary';
  }
}

function SimuladosListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1, 2, 3, 4].map((index) => (
        <div
          key={index}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-5 w-56 max-w-full" />
              <Skeleton className="h-5 w-28 rounded-lg" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="h-9 w-36 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SimuladosPage() {
  const navigate = useNavigate();

  const [statusTab, setStatusTab] = useState<StatusTabValue>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SimuladoSortBy>('recent');
  const [page, setPage] = useState(1);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deletingSimulado, setDeletingSimulado] =
    useState<SimuladoListItemDto | null>(null);

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

  const listQuery = useSimuladosListQuery({
    page,
    limit: PAGE_LIMIT,
    status: statusTab === 'ALL' ? undefined : statusTab,
    search: debouncedSearch || undefined,
    sortBy,
  });

  const deleteMutation = useDeleteSimuladoMutation();

  const items = listQuery.data?.items ?? [];
  const pagination = listQuery.data?.pagination;

  useEffect(() => {
    if (pagination && pagination.totalPages > 0 && page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [pagination, page]);

  function handleClearFilters(): void {
    setSearchInput('');
    setDebouncedSearch('');
    setStatusTab('ALL');
    setSortBy('recent');
    setPage(1);
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deletingSimulado || deleteMutation.isPending) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(deletingSimulado.id);
      setDeletingSimulado(null);
    } catch {
      // Erro tratado via toast no hook.
    }
  }

  const hasActiveFilters =
    debouncedSearch.length > 0 || statusTab !== 'ALL';

  const hasCustomControls =
    searchInput.trim().length > 0 ||
    debouncedSearch.length > 0 ||
    statusTab !== 'ALL' ||
    sortBy !== 'recent';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2.5">
            <Timer
              className="h-5 w-5 shrink-0 text-primary"
              strokeWidth={1.75}
            />
            <h1 className="text-2xl font-bold tracking-tight">Simulados</h1>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Prepare provas em PDF, execute em tela isolada com cronômetro
            resiliente e classifique suas questões após encerrar.
          </p>
        </div>

        <Button
          type="button"
          variant="default"
          onClick={() => setCreateDialogOpen(true)}
          className="w-full shrink-0 gap-2 sm:w-auto"
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>Novo Simulado</span>
        </Button>
      </header>

      <Tabs
        value={statusTab}
        onValueChange={(value) => {
          if (
            value === 'ALL' ||
            value === 'PREPARACAO' ||
            value === 'EM_ANDAMENTO' ||
            value === 'FINALIZADO'
          ) {
            setStatusTab(value);
            setPage(1);
          }
        }}
        className="space-y-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:h-10 sm:w-auto">
          <TabsTrigger value="ALL">Todos</TabsTrigger>
          <TabsTrigger value="PREPARACAO">Em Preparação</TabsTrigger>
          <TabsTrigger value="EM_ANDAMENTO">Em Andamento</TabsTrigger>
          <TabsTrigger value="FINALIZADO">Finalizados</TabsTrigger>
        </TabsList>

        <section
          aria-label="Filtros e ordenação de simulados"
          className="rounded-2xl border border-border bg-card p-3 sm:p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="relative min-w-0 sm:col-span-8 lg:col-span-9">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.75}
              />
              <Input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar simulado por título..."
                aria-label="Buscar simulados por título"
                className="pl-9 pr-9"
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

            <div className="min-w-0 sm:col-span-4 lg:col-span-3">
              <Select
                value={sortBy}
                onValueChange={(value) => {
                  const matched = SIMULADO_SORT_OPTIONS.find(
                    (option) => option === value
                  );
                  if (matched) {
                    setSortBy(matched);
                    setPage(1);
                  }
                }}
              >
                <SelectTrigger
                  aria-label="Ordenar simulados"
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
                  {SIMULADO_SORT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {SORT_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasCustomControls ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {pagination
                  ? `${pagination.total} ${
                      pagination.total === 1
                        ? 'simulado encontrado'
                        : 'simulados encontrados'
                    }`
                  : 'Filtros ou ordenação ativos'}
              </span>

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
            </div>
          ) : null}
        </section>

        {listQuery.isPending ? (
          <SimuladosListSkeleton />
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
              <Timer className="h-5 w-5" strokeWidth={1.75} />
            </div>

            <h2 className="text-base font-semibold text-foreground">
              {hasActiveFilters
                ? 'Nenhum simulado encontrado com os filtros atuais'
                : 'Nenhum simulado cadastrado ainda'}
            </h2>

            <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
              {hasActiveFilters
                ? 'Ajuste a busca ou altere a aba de status para visualizar outros simulados.'
                : 'Crie seu primeiro simulado para anexar o PDF da prova, cadastrar questões e cronometrar a execução.'}
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
                <Button
                  type="button"
                  onClick={() => setCreateDialogOpen(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                  <span>Novo Simulado</span>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              {items.map((simulado) => {
                const detailTarget =
                  simulado.status === 'EM_ANDAMENTO'
                    ? `/simulados/${simulado.id}/execucao`
                    : `/simulados/${simulado.id}`;

                return (
                  <article
                    key={simulado.id}
                    className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-700 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={detailTarget}
                          className="min-w-0 max-w-full break-words text-base font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
                        >
                          {simulado.titulo}
                        </Link>
                        <Badge
                          variant={getStatusBadgeVariant(simulado.status)}
                          className="shrink-0 whitespace-nowrap"
                        >
                          {SIMULADO_STATUS_LABELS[simulado.status]}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                          <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                          <span>
                            Duração:{' '}
                            <strong className="font-medium text-foreground">
                              {formatConfiguredDuration(
                                simulado.duracaoConfiguradaSegundos
                              )}
                            </strong>
                          </span>
                        </span>

                        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap tabular-nums">
                          <ListChecks
                            className="h-3.5 w-3.5"
                            strokeWidth={1.75}
                          />
                          <span>
                            {simulado.totalQuestoes}{' '}
                            {simulado.totalQuestoes === 1
                              ? 'questão'
                              : 'questões'}
                          </span>
                        </span>

                        {simulado.status === 'PREPARACAO' ? (
                          <>
                            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                              <FileText
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                              <span>
                                {simulado.hasPdf ? 'PDF anexado' : 'Sem PDF'}
                              </span>
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                              <Calendar
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                              <span>
                                Criado em {formatLocalDate(simulado.createdAt)}
                              </span>
                            </span>
                          </>
                        ) : null}

                        {simulado.status === 'EM_ANDAMENTO' ? (
                          <>
                            {simulado.startedAt ? (
                              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                                <Calendar
                                  className="h-3.5 w-3.5"
                                  strokeWidth={1.75}
                                />
                                <span>
                                  Iniciado em{' '}
                                  {formatLocalDateTime(simulado.startedAt)}
                                </span>
                              </span>
                            ) : null}
                            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap tabular-nums">
                              <MessageSquareText
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                              <span>
                                {simulado.totalPensamentos}{' '}
                                {simulado.totalPensamentos === 1
                                  ? 'pensamento'
                                  : 'pensamentos'}
                              </span>
                            </span>
                          </>
                        ) : null}

                        {simulado.status === 'FINALIZADO' ? (
                          <>
                            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                              <Timer
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                              <span>
                                Tempo gasto:{' '}
                                <strong className="font-mono font-medium text-foreground">
                                  {formatClockDuration(
                                    simulado.tempoGastoSegundos
                                  )}
                                </strong>
                              </span>
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap tabular-nums">
                              <BookOpenCheck
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                              <span>
                                Classificadas:{' '}
                                {simulado.totalQuestoesClassificadas}/
                                {simulado.totalQuestoes}
                              </span>
                            </span>
                            {simulado.totalQuestoesClassificadas > 0 ? (
                              <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap tabular-nums">
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  {simulado.totalAcertos} acertos
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="text-amber-600 dark:text-amber-400">
                                  {simulado.totalParciais} parciais
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="text-rose-600 dark:text-rose-400">
                                  {simulado.totalErros} erros
                                </span>
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {simulado.status === 'PREPARACAO' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="gap-1.5"
                        >
                          <Link to={`/simulados/${simulado.id}`}>
                            <SlidersHorizontal
                              className="h-3.5 w-3.5"
                              strokeWidth={1.75}
                            />
                            <span>Preparar</span>
                          </Link>
                        </Button>
                      ) : null}

                      {simulado.status === 'EM_ANDAMENTO' ? (
                        <Button
                          variant="default"
                          size="sm"
                          asChild
                          className="gap-1.5"
                        >
                          <Link to={`/simulados/${simulado.id}/execucao`}>
                            <Play className="h-3.5 w-3.5" strokeWidth={1.75} />
                            <span>Retomar Prova</span>
                          </Link>
                        </Button>
                      ) : null}

                      {simulado.status === 'FINALIZADO' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="gap-1.5"
                        >
                          <Link to={`/simulados/${simulado.id}`}>
                            <BookOpenCheck
                              className="h-3.5 w-3.5"
                              strokeWidth={1.75}
                            />
                            <span>Visualizar Pós-Prova</span>
                          </Link>
                        </Button>
                      ) : null}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingSimulado(simulado)}
                        aria-label={`Excluir simulado ${simulado.titulo}`}
                        title="Excluir simulado"
                        className="h-8 w-8 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>

            {pagination && pagination.totalPages > 0 ? (
              <nav
                aria-label="Paginação de simulados"
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
                  {pagination.total === 1 ? 'simulado' : 'simulados'})
                </p>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1 || listQuery.isFetching}
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
                      listQuery.isFetching
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

      <SimuladoFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={(created) => {
          navigate(`/simulados/${created.id}`);
        }}
      />

      <AlertDialog
        open={Boolean(deletingSimulado)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteMutation.isPending) {
            setDeletingSimulado(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir simulado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{' '}
              <strong className="font-semibold text-foreground">
                {deletingSimulado?.titulo}
              </strong>
              ? Esta ação remove permanentemente questões, pensamentos, PDF
              anexado e eventuais registros vinculados no Caderno de Erros.
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
                <span>Excluir permanentemente</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
