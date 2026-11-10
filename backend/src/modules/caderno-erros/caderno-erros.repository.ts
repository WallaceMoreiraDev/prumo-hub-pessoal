import { ERROR_CODES } from '@shared/types/api.types';
import type { CadernoErrosQuery } from '@shared/schemas/caderno-erros.schema';
import type {
  ErroOrigem,
  ErroStatus,
  ReviewMode,
} from '@shared/types/enums.types';
import type { AppSupabaseClient } from '../../config/supabase';
import { AppError } from '../../errors/AppError';
import {
  mapSupabaseError,
  throwIfSupabaseError,
} from '../../utils/supabaseErrorMapper';
import type { CadernoErroWithRelationsRow } from './caderno-erros.mapper';

const CADERNO_ERRO_SELECT = `
  id,
  user_id,
  origem,
  status,
  simulado_questao_id,
  codigo_referencia,
  titulo,
  enunciado_completo,
  link_externo,
  observacao_erro,
  last_reviewed_at,
  last_review_mode,
  created_at,
  updated_at,
  caderno_erro_temas(
    tema:temas!caderno_erro_temas_tema_id_fkey(
      id,
      nome,
      last_reviewed_at,
      last_review_mode
    )
  ),
  simulado_questao:simulado_questoes!caderno_erros_simulado_questao_id_fkey(
    id,
    simulado_id,
    numero_questao,
    titulo_questao,
    resultado,
    simulado:simulados!simulado_questoes_simulado_id_fkey(
      id,
      titulo
    ),
    simulado_pensamentos(
      id,
      user_id,
      simulado_questao_id,
      descricao,
      tempo_decorrido_segundos,
      created_at,
      updated_at
    )
  )
` as const;

const IN_CLAUSE_CHUNK_SIZE = 100;

function buildSearchOrFilter(rawSearch: string | undefined): string | undefined {
  if (!rawSearch) {
    return undefined;
  }

  const trimmed = rawSearch.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const escapedWildcards = trimmed.replace(/[\\%_]/g, (match) => `\\${match}`);
  const neutralized = escapedWildcards.replace(/[,()]/g, '_').trim();

  if (neutralized.length === 0) {
    return undefined;
  }

  const pattern = `%${neutralized}%`;
  return [
    `titulo.ilike.${pattern}`,
    `codigo_referencia.ilike.${pattern}`,
    `enunciado_completo.ilike.${pattern}`,
    `observacao_erro.ilike.${pattern}`,
  ].join(',');
}

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export interface PaginatedCadernoErrosResult {
  rows: CadernoErroWithRelationsRow[];
  total: number;
}

export interface CreateCadernoErroRecordParams {
  origem: ErroOrigem;
  codigoReferencia: string | null;
  titulo: string;
  enunciadoCompleto: string | null;
  linkExterno: string | null;
  observacaoErro: string | null;
  temaIds: readonly string[];
}

export interface CadernoErroEditableColumns {
  codigo_referencia: string | null;
  titulo: string;
  enunciado_completo: string | null;
  link_externo: string | null;
  observacao_erro: string | null;
}

export interface UpdateCadernoErroRecordParams {
  id: string;
  previousColumns: CadernoErroEditableColumns;
  nextColumns: CadernoErroEditableColumns;
  toAddTemaIds: readonly string[];
  toRemoveTemaIds: readonly string[];
}

export class CadernoErrosRepository {
  public async listPaginated(
    supabase: AppSupabaseClient,
    userId: string,
    query: CadernoErrosQuery
  ): Promise<PaginatedCadernoErrosResult> {
    const { page, limit, status, temaId, origem, search, sortBy } = query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const searchOrFilter = buildSearchOrFilter(search);

    let matchingErroIds: string[] | undefined;

    if (temaId !== undefined) {
      const { data: matchedLinks, error: linksError } = await supabase
        .from('caderno_erro_temas')
        .select('caderno_erro_id, caderno_erros!inner(id)')
        .eq('tema_id', temaId)
        .eq('caderno_erros.user_id', userId);

      throwIfSupabaseError(linksError, ERROR_CODES.CADERNO_ERRO_NOT_FOUND);

      matchingErroIds = [
        ...new Set((matchedLinks ?? []).map((row) => row.caderno_erro_id)),
      ];

      if (matchingErroIds.length === 0) {
        return { rows: [], total: 0 };
      }
    }

    if (
      matchingErroIds !== undefined &&
      matchingErroIds.length > IN_CLAUSE_CHUNK_SIZE
    ) {
      return this.listChunkedByMatchingIds(supabase, userId, matchingErroIds, {
        from,
        limit,
        status,
        origem,
        searchOrFilter,
        sortBy,
      });
    }

    let dataQuery = supabase
      .from('caderno_erros')
      .select(CADERNO_ERRO_SELECT, { count: 'exact' })
      .eq('user_id', userId);

    if (matchingErroIds !== undefined) {
      dataQuery = dataQuery.in('id', matchingErroIds);
    }

    if (status !== undefined) {
      dataQuery = dataQuery.eq('status', status);
    }

    if (origem !== undefined) {
      dataQuery = dataQuery.eq('origem', origem);
    }

    if (searchOrFilter !== undefined) {
      dataQuery = dataQuery.or(searchOrFilter);
    }

    dataQuery = dataQuery
      .order('created_at', { ascending: sortBy === 'oldest' })
      .order('id', { ascending: true });

    const { data, error, count } = await dataQuery.range(from, to);

    if (error?.code === 'PGRST103') {
      let countQuery = supabase
        .from('caderno_erros')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (matchingErroIds !== undefined) {
        countQuery = countQuery.in('id', matchingErroIds);
      }

      if (status !== undefined) {
        countQuery = countQuery.eq('status', status);
      }

      if (origem !== undefined) {
        countQuery = countQuery.eq('origem', origem);
      }

      if (searchOrFilter !== undefined) {
        countQuery = countQuery.or(searchOrFilter);
      }

      const { count: fallbackCount, error: countError } = await countQuery;
      throwIfSupabaseError(countError, ERROR_CODES.CADERNO_ERRO_NOT_FOUND);

      return {
        rows: [],
        total: fallbackCount ?? 0,
      };
    }

    throwIfSupabaseError(error, ERROR_CODES.CADERNO_ERRO_NOT_FOUND);

    return {
      rows: (data ?? []) as CadernoErroWithRelationsRow[],
      total: count ?? 0,
    };
  }

  private async listChunkedByMatchingIds(
    supabase: AppSupabaseClient,
    userId: string,
    matchingErroIds: readonly string[],
    options: {
      from: number;
      limit: number;
      status: ErroStatus | undefined;
      origem: ErroOrigem | undefined;
      searchOrFilter: string | undefined;
      sortBy: 'recent' | 'oldest';
    }
  ): Promise<PaginatedCadernoErrosResult> {
    const chunks = chunkArray(matchingErroIds, IN_CLAUSE_CHUNK_SIZE);

    const metaResponses = await Promise.all(
      chunks.map((chunk) => {
        let metaQuery = supabase
          .from('caderno_erros')
          .select('id, created_at')
          .eq('user_id', userId)
          .in('id', chunk);

        if (options.status !== undefined) {
          metaQuery = metaQuery.eq('status', options.status);
        }

        if (options.origem !== undefined) {
          metaQuery = metaQuery.eq('origem', options.origem);
        }

        if (options.searchOrFilter !== undefined) {
          metaQuery = metaQuery.or(options.searchOrFilter);
        }

        return metaQuery;
      })
    );

    const matchedMeta: Array<{ id: string; created_at: string }> = [];
    for (const response of metaResponses) {
      throwIfSupabaseError(response.error, ERROR_CODES.CADERNO_ERRO_NOT_FOUND);
      if (response.data) {
        matchedMeta.push(...response.data);
      }
    }

    matchedMeta.sort((a, b) => {
      const timeA = Date.parse(a.created_at);
      const timeB = Date.parse(b.created_at);
      if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
        return options.sortBy === 'oldest' ? timeA - timeB : timeB - timeA;
      }
      if (a.created_at !== b.created_at) {
        const cmp = a.created_at < b.created_at ? -1 : 1;
        return options.sortBy === 'oldest' ? cmp : -cmp;
      }
      return a.id.localeCompare(b.id);
    });

    const total = matchedMeta.length;
    const pageIds = matchedMeta
      .slice(options.from, options.from + options.limit)
      .map((item) => item.id);

    if (pageIds.length === 0) {
      return { rows: [], total };
    }

    const { data, error } = await supabase
      .from('caderno_erros')
      .select(CADERNO_ERRO_SELECT)
      .eq('user_id', userId)
      .in('id', pageIds)
      .order('created_at', { ascending: options.sortBy === 'oldest' })
      .order('id', { ascending: true });

    throwIfSupabaseError(error, ERROR_CODES.CADERNO_ERRO_NOT_FOUND);

    const rowsById = new Map<string, CadernoErroWithRelationsRow>();
    for (const row of (data ?? []) as CadernoErroWithRelationsRow[]) {
      rowsById.set(row.id, row);
    }

    const orderedRows: CadernoErroWithRelationsRow[] = [];
    for (const id of pageIds) {
      const row = rowsById.get(id);
      if (row) {
        orderedRows.push(row);
      }
    }

    return {
      rows: orderedRows,
      total,
    };
  }

  public async findById(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<CadernoErroWithRelationsRow | null> {
    const { data, error } = await supabase
      .from('caderno_erros')
      .select(CADERNO_ERRO_SELECT)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.CADERNO_ERRO_NOT_FOUND);
    return data as CadernoErroWithRelationsRow | null;
  }

  public async create(
    supabase: AppSupabaseClient,
    userId: string,
    params: CreateCadernoErroRecordParams
  ): Promise<CadernoErroWithRelationsRow> {
    const { data: created, error: insertError } = await supabase
      .from('caderno_erros')
      .insert({
        user_id: userId,
        origem: params.origem,
        status: 'PENDENTE',
        simulado_questao_id: null,
        codigo_referencia: params.codigoReferencia,
        titulo: params.titulo,
        enunciado_completo: params.enunciadoCompleto,
        link_externo: params.linkExterno,
        observacao_erro: params.observacaoErro,
        last_reviewed_at: null,
        last_review_mode: null,
      })
      .select('id')
      .single();

    throwIfSupabaseError(insertError, ERROR_CODES.CADERNO_ERRO_NOT_FOUND);
    if (!created) {
      throw new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, 500);
    }

    if (params.temaIds.length > 0) {
      const linkRows = params.temaIds.map((temaId) => ({
        caderno_erro_id: created.id,
        tema_id: temaId,
      }));

      const { error: linkError } = await supabase
        .from('caderno_erro_temas')
        .insert(linkRows);

      if (linkError !== null) {
        await supabase
          .from('caderno_erros')
          .delete()
          .eq('id', created.id)
          .eq('user_id', userId);
        throw mapSupabaseError(linkError, ERROR_CODES.TEMA_NOT_FOUND);
      }
    }

    const createdRow = await this.findById(supabase, userId, created.id);
    if (!createdRow) {
      throw new AppError(ERROR_CODES.CADERNO_ERRO_NOT_FOUND, 404);
    }

    return createdRow;
  }

  public async update(
    supabase: AppSupabaseClient,
    userId: string,
    params: UpdateCadernoErroRecordParams
  ): Promise<CadernoErroWithRelationsRow> {
    const {
      id,
      previousColumns,
      nextColumns,
      toAddTemaIds,
      toRemoveTemaIds,
    } = params;

    const { data: updated, error: updateError } = await supabase
      .from('caderno_erros')
      .update(nextColumns)
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    throwIfSupabaseError(updateError, ERROR_CODES.CADERNO_ERRO_NOT_FOUND);
    if (!updated) {
      throw new AppError(ERROR_CODES.CADERNO_ERRO_NOT_FOUND, 404);
    }

    if (toAddTemaIds.length > 0) {
      const linkRows = toAddTemaIds.map((temaId) => ({
        caderno_erro_id: id,
        tema_id: temaId,
      }));

      const { error: addError } = await supabase
        .from('caderno_erro_temas')
        .insert(linkRows);

      if (addError !== null) {
        await supabase
          .from('caderno_erros')
          .update(previousColumns)
          .eq('id', id)
          .eq('user_id', userId);
        throw mapSupabaseError(addError, ERROR_CODES.TEMA_NOT_FOUND);
      }
    }

    if (toRemoveTemaIds.length > 0) {
      const { error: removeError } = await supabase
        .from('caderno_erro_temas')
        .delete()
        .eq('caderno_erro_id', id)
        .in('tema_id', [...toRemoveTemaIds]);

      if (removeError !== null) {
        if (toAddTemaIds.length > 0) {
          await supabase
            .from('caderno_erro_temas')
            .delete()
            .eq('caderno_erro_id', id)
            .in('tema_id', [...toAddTemaIds]);
        }

        await supabase
          .from('caderno_erros')
          .update(previousColumns)
          .eq('id', id)
          .eq('user_id', userId);

        throw mapSupabaseError(removeError, ERROR_CODES.CADERNO_ERRO_NOT_FOUND);
      }
    }

    const updatedRow = await this.findById(supabase, userId, id);
    if (!updatedRow) {
      throw new AppError(ERROR_CODES.CADERNO_ERRO_NOT_FOUND, 404);
    }

    return updatedRow;
  }

  public async concluirRevisaoRpc(
    supabase: AppSupabaseClient,
    userId: string,
    id: string,
    reviewMode: ReviewMode
  ): Promise<CadernoErroWithRelationsRow> {
    const { error: rpcError } = await supabase.rpc(
      'rpc_concluir_revisao_erro',
      {
        p_caderno_erro_id: id,
        p_review_mode: reviewMode,
      }
    );

    throwIfSupabaseError(rpcError, ERROR_CODES.CADERNO_ERRO_NOT_FOUND);

    const updatedRow = await this.findById(supabase, userId, id);
    if (!updatedRow) {
      throw new AppError(ERROR_CODES.CADERNO_ERRO_NOT_FOUND, 404);
    }

    return updatedRow;
  }

  public async devolverParaPendenteRpc(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<CadernoErroWithRelationsRow> {
    const { error: rpcError } = await supabase.rpc(
      'rpc_devolver_erro_para_pendente',
      {
        p_caderno_erro_id: id,
      }
    );

    throwIfSupabaseError(rpcError, ERROR_CODES.CADERNO_ERRO_NOT_FOUND);

    const updatedRow = await this.findById(supabase, userId, id);
    if (!updatedRow) {
      throw new AppError(ERROR_CODES.CADERNO_ERRO_NOT_FOUND, 404);
    }

    return updatedRow;
  }

  public async delete(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<{ id: string } | null> {
    const { data, error } = await supabase
      .from('caderno_erros')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.CADERNO_ERRO_NOT_FOUND);
    return data;
  }
}

export const cadernoErrosRepository = new CadernoErrosRepository();
