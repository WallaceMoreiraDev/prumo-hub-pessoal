import { useEffect, useMemo, useState } from 'react';
import { CreateTemaSchema } from '@shared/schemas/temas.schema';
import type { TemaSummaryDto } from '@shared/types/temas.types';
import { Check, Loader2, Plus, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCreateTemaMutation,
  useTemasOptionsQuery,
} from '@/features/temas-revisao/hooks/useTemas';
import { toTemaSummary } from '@/features/temas-revisao/utils/reflexoes';
import { cn } from '@/lib/utils';

interface TemaSelectorBaseProps {
  excludeIds?: string[];
  initialSelectedTemas?: TemaSummaryDto[];
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  autoFocusSearch?: boolean;
}

export interface TemaSelectorSingleProps extends TemaSelectorBaseProps {
  mode: 'single';
  value: string | null;
  onChange: (nextId: string | null, selectedTema?: TemaSummaryDto) => void;
}

export interface TemaSelectorMultipleProps extends TemaSelectorBaseProps {
  mode: 'multiple';
  value: string[];
  onChange: (nextIds: string[], selectedTemas?: TemaSummaryDto[]) => void;
}

export type TemaSelectorProps =
  | TemaSelectorSingleProps
  | TemaSelectorMultipleProps;

export function TemaSelector(props: TemaSelectorProps) {
  const {
    excludeIds = [],
    initialSelectedTemas = [],
    placeholder = 'Buscar tema ou digitar novo nome...',
    emptyLabel = 'Nenhum tema encontrado.',
    disabled = false,
    autoFocusSearch = false,
  } = props;

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [knownTemas, setKnownTemas] = useState<Map<string, TemaSummaryDto>>(
    () => new Map()
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    if (initialSelectedTemas.length === 0) {
      return;
    }

    setKnownTemas((prev) => {
      const next = new Map(prev);
      for (const tema of initialSelectedTemas) {
        next.set(tema.id, tema);
      }
      return next;
    });
  }, [initialSelectedTemas]);

  const optionsQuery = useTemasOptionsQuery(debouncedSearch, true);
  const createTemaMutation = useCreateTemaMutation({
    successMessage: 'Tema criado e selecionado.',
  });

  useEffect(() => {
    const items = optionsQuery.data?.items;
    if (!items || items.length === 0) {
      return;
    }

    setKnownTemas((prev) => {
      const next = new Map(prev);
      for (const item of items) {
        next.set(item.id, toTemaSummary(item));
      }
      return next;
    });
  }, [optionsQuery.data?.items]);

  const excludedSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  const selectedIds = useMemo<string[]>(() => {
    if (props.mode === 'single') {
      return props.value ? [props.value] : [];
    }
    return props.value;
  }, [props.mode, props.value]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedSummaries = useMemo<TemaSummaryDto[]>(() => {
    return selectedIds
      .map((id) => knownTemas.get(id))
      .filter((item): item is TemaSummaryDto => item !== undefined);
  }, [selectedIds, knownTemas]);

  const visibleOptions = useMemo<TemaSummaryDto[]>(() => {
    const items = optionsQuery.data?.items ?? [];
    return items
      .filter((item) => !excludedSet.has(item.id))
      .map((item) => toTemaSummary(item));
  }, [optionsQuery.data?.items, excludedSet]);

  const trimmedSearch = searchInput.trim();
  const exactMatchExists = useMemo(() => {
    if (!trimmedSearch) {
      return false;
    }
    const lowerTarget = trimmedSearch.toLowerCase();
    const items = optionsQuery.data?.items ?? [];
    if (items.some((item) => item.nome.trim().toLowerCase() === lowerTarget)) {
      return true;
    }
    for (const item of knownTemas.values()) {
      if (item.nome.trim().toLowerCase() === lowerTarget) {
        return true;
      }
    }
    return false;
  }, [trimmedSearch, optionsQuery.data?.items, knownTemas]);

  function handleSelectOption(option: TemaSummaryDto): void {
    if (disabled) {
      return;
    }

    if (props.mode === 'single') {
      if (props.value === option.id) {
        props.onChange(null, undefined);
      } else {
        props.onChange(option.id, option);
      }
      return;
    }

    if (selectedSet.has(option.id)) {
      const nextIds = props.value.filter((id) => id !== option.id);
      const nextSummaries = nextIds
        .map((id) => knownTemas.get(id))
        .filter((item): item is TemaSummaryDto => item !== undefined);
      props.onChange(nextIds, nextSummaries);
    } else {
      const nextIds = [...props.value, option.id];
      const nextSummaries = [
        ...selectedSummaries,
        option,
      ];
      props.onChange(nextIds, nextSummaries);
    }
  }

  function handleRemoveSelected(idToRemove: string): void {
    if (disabled) {
      return;
    }

    if (props.mode === 'single') {
      props.onChange(null, undefined);
      return;
    }

    const nextIds = props.value.filter((id) => id !== idToRemove);
    const nextSummaries = nextIds
      .map((id) => knownTemas.get(id))
      .filter((item): item is TemaSummaryDto => item !== undefined);
    props.onChange(nextIds, nextSummaries);
  }

  async function handleCreateInline(): Promise<void> {
    if (disabled || createTemaMutation.isPending) {
      return;
    }

    const parsed = CreateTemaSchema.safeParse({ nome: trimmedSearch });
    if (!parsed.success) {
      setInlineError(
        parsed.error.issues[0]?.message ?? 'Nome de tema inválido.'
      );
      return;
    }

    setInlineError(null);
    try {
      const created = await createTemaMutation.mutateAsync({
        nome: parsed.data.nome,
      });
      const summary = toTemaSummary(created);

      setKnownTemas((prev) => {
        const next = new Map(prev);
        next.set(summary.id, summary);
        return next;
      });

      if (props.mode === 'single') {
        props.onChange(summary.id, summary);
      } else if (!selectedSet.has(summary.id)) {
        const nextIds = [...props.value, summary.id];
        const nextSummaries = [...selectedSummaries, summary];
        props.onChange(nextIds, nextSummaries);
      }

      setSearchInput('');
      setDebouncedSearch('');
    } catch {
      // Erro já notificado via toast no hook de mutação.
    }
  }

  return (
    <div className="space-y-2.5 min-w-0">
      {selectedSummaries.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 min-w-0">
          {selectedSummaries.map((tema) => (
            <Badge
              key={tema.id}
              variant="secondary"
              className="max-w-full gap-1.5 py-1 pl-2.5 pr-1.5 text-xs font-medium"
            >
              <span className="min-w-0 truncate">{tema.nome}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleRemoveSelected(tema.id)}
                aria-label={`Remover tema ${tema.nome}`}
                className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
          />
          <Input
            type="text"
            value={searchInput}
            autoFocus={autoFocusSearch}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(event) => {
              setSearchInput(event.target.value);
              if (inlineError) {
                setInlineError(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (trimmedSearch.length > 0 && !exactMatchExists) {
                  void handleCreateInline();
                }
              }
            }}
            className="pl-9 pr-9"
          />
          {searchInput.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setDebouncedSearch('');
                setInlineError(null);
              }}
              aria-label="Limpar busca de tema"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>

        {inlineError ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            {inlineError}
          </p>
        ) : null}
      </div>

      {trimmedSearch.length > 0 && !exactMatchExists ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || createTemaMutation.isPending}
          onClick={() => void handleCreateInline()}
          className="h-auto w-full justify-start gap-2 border-dashed py-2 text-left whitespace-normal"
        >
          {createTemaMutation.isPending ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={1.75} />
          ) : (
            <Plus className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
          )}
          <span className="min-w-0 break-words text-xs">
            Criar e selecionar tema{' '}
            <strong className="font-semibold text-foreground">
              {trimmedSearch}
            </strong>
          </span>
        </Button>
      ) : null}

      <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-background/70 p-1.5">
        {optionsQuery.isPending ? (
          <div className="space-y-1.5 p-1">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-4/5 rounded-lg" />
          </div>
        ) : visibleOptions.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          <div className="space-y-1">
            {visibleOptions.map((option) => {
              const isSelected = selectedSet.has(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSelectOption(option)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-foreground hover:bg-accent'
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{option.nome}</span>
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background'
                    )}
                  >
                    {isSelected ? (
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
