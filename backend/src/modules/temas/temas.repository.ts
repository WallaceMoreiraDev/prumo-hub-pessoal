import { ERROR_CODES } from '@shared/types/api.types';
import type { ReviewMode } from '@shared/types/enums.types';
import type { TemasQuery } from '@shared/schemas/temas.schema';
import type { AppSupabaseClient } from '../../config/supabase';
import { AppError } from '../../errors/AppError';
import {
  mapSupabaseError,
  throwIfSupabaseError,
} from '../../utils/supabaseErrorMapper';
import {
  LOUSA_RELATION_SELECT,
  type LousaRelationRow,
} from '../lousas/lousas.mapper';
import type { LousaStoragePaths } from '../lousas/lousas.repository';
import {
  unwrapSingleRelation,
  type ReflexaoWithRelationsRow,
  type TemaRow,
} from './temas.mapper';

const TEMA_SELECT =
  'id, user_id, nome, last_reviewed_at, last_review_mode, created_at, updated_at' as const;

const REFLEXAO_SELECT = `
  id,
  user_id,
  tema_principal_id,
  conteudo,
  lousa_id,
  created_at,
  updated_at,
  lousa:lousas!reflexoes_lousa_id_fkey(
    ${LOUSA_RELATION_SELECT}
  ),
  tema_principal:temas!reflexoes_tema_principal_id_fkey(
    id,
    nome,
    last_reviewed_at,
    last_review_mode
  ),
  reflexao_temas_conectados(
    tema_conectado:temas!reflexao_temas_conectados_tema_conectado_id_fkey(
      id,
      nome,
      last_reviewed_at,
      last_review_mode
    )
  )
` as const;

const IN_CLAUSE_CHUNK_SIZE = 100;

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export interface PaginatedTemasResult {
  rows: TemaRow[];
  total: number;
}

export interface ErrosCountPorTemaResult {
  pendentes: number;
  revisados: number;
}

export interface CreateReflexaoRecordParams {
  temaPrincipalId: string;
  temaConectadoIds: readonly string[];
  conteudo: string | null;
  lousaId: string | null;
}

export interface UpdateReflexaoRecordParams {
  id: string;
  previousTemaPrincipalId: string;
  previousConteudo: string | null;
  previousLousaId: string | null;
  nextTemaPrincipalId: string;
  nextConteudo: string | null;
  nextLousaId: string | null;
  toAddConnectedIds: readonly string[];
  toRemoveConnectedIds: readonly string[];
}

export class TemasRepository {
  public async listTemasPaginated(
    supabase: AppSupabaseClient,
    userId: string,
    query: TemasQuery
  ): Promise<PaginatedTemasResult> {
    const { page, limit, search, sortBy, reviewMode } = query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const normalizedSearch = search && search.length > 0 ? search : undefined;

    let dataQuery = supabase
      .from('temas')
      .select(TEMA_SELECT, { count: 'exact' })
      .eq('user_id', userId);

    if (normalizedSearch !== undefined) {
      dataQuery = dataQuery.ilike(
        'nome',
        `%${escapeLikePattern(normalizedSearch)}%`
      );
    }

    if (reviewMode !== undefined) {
      dataQuery = dataQuery.eq('last_review_mode', reviewMode);
    }

    switch (sortBy) {
      case 'oldest_review': {
        dataQuery = dataQuery
          .order('last_reviewed_at', { ascending: true, nullsFirst: true })
          .order('nome', { ascending: true })
          .order('id', { ascending: true });
        break;
      }
      case 'recent_review': {
        dataQuery = dataQuery
          .order('last_reviewed_at', { ascending: false, nullsFirst: false })
          .order('nome', { ascending: true })
          .order('id', { ascending: true });
        break;
      }
      case 'name_asc': {
        dataQuery = dataQuery
          .order('nome', { ascending: true })
          .order('id', { ascending: true });
        break;
      }
    }

    const { data, error, count } = await dataQuery.range(from, to);

    if (error?.code === 'PGRST103') {
      let countQuery = supabase
        .from('temas')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (normalizedSearch !== undefined) {
        countQuery = countQuery.ilike(
          'nome',
          `%${escapeLikePattern(normalizedSearch)}%`
        );
      }

      if (reviewMode !== undefined) {
        countQuery = countQuery.eq('last_review_mode', reviewMode);
      }

      const { count: fallbackCount, error: countError } = await countQuery;
      throwIfSupabaseError(countError, ERROR_CODES.TEMA_NOT_FOUND);

      return {
        rows: [],
        total: fallbackCount ?? 0,
      };
    }

    throwIfSupabaseError(error, ERROR_CODES.TEMA_NOT_FOUND);

    return {
      rows: data ?? [],
      total: count ?? 0,
    };
  }

  public async findReflexoesTouchingTemaIds(
    supabase: AppSupabaseClient,
    userId: string,
    temaIds: readonly string[]
  ): Promise<ReflexaoWithRelationsRow[]> {
    const uniqueTemaIds = [...new Set(temaIds)];
    if (uniqueTemaIds.length === 0) {
      return [];
    }

    const [principalRes, conectadoRes] = await Promise.all([
      supabase
        .from('reflexoes')
        .select('id')
        .eq('user_id', userId)
        .in('tema_principal_id', uniqueTemaIds),
      supabase
        .from('reflexao_temas_conectados')
        .select('reflexao_id, reflexoes!inner(id)')
        .in('tema_conectado_id', uniqueTemaIds)
        .eq('reflexoes.user_id', userId),
    ]);

    throwIfSupabaseError(principalRes.error, ERROR_CODES.REFLEXAO_NOT_FOUND);
    throwIfSupabaseError(conectadoRes.error, ERROR_CODES.REFLEXAO_NOT_FOUND);

    const reflexaoIdSet = new Set<string>();
    for (const row of principalRes.data ?? []) {
      reflexaoIdSet.add(row.id);
    }
    for (const row of conectadoRes.data ?? []) {
      reflexaoIdSet.add(row.reflexao_id);
    }

    if (reflexaoIdSet.size === 0) {
      return [];
    }

    const chunks = chunkArray([...reflexaoIdSet], IN_CLAUSE_CHUNK_SIZE);
    const chunkResponses = await Promise.all(
      chunks.map((chunk) =>
        supabase
          .from('reflexoes')
          .select(REFLEXAO_SELECT)
          .eq('user_id', userId)
          .in('id', chunk)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
      )
    );

    const rows: ReflexaoWithRelationsRow[] = [];
    for (const response of chunkResponses) {
      throwIfSupabaseError(response.error, ERROR_CODES.REFLEXAO_NOT_FOUND);
      if (response.data) {
        rows.push(...(response.data as ReflexaoWithRelationsRow[]));
      }
    }

    if (chunkResponses.length > 1) {
      rows.sort((a, b) => {
        const timeDiff = Date.parse(b.created_at) - Date.parse(a.created_at);
        if (timeDiff !== 0 && !Number.isNaN(timeDiff)) {
          return timeDiff;
        }
        if (a.created_at !== b.created_at) {
          return a.created_at > b.created_at ? -1 : 1;
        }
        return a.id.localeCompare(b.id);
      });
    }

    return rows;
  }

  public async findTemaById(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<TemaRow | null> {
    const { data, error } = await supabase
      .from('temas')
      .select(TEMA_SELECT)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.TEMA_NOT_FOUND);
    return data;
  }

  public async countTemasByIds(
    supabase: AppSupabaseClient,
    userId: string,
    temaIds: readonly string[]
  ): Promise<number> {
    const uniqueTemaIds = [...new Set(temaIds)];
    if (uniqueTemaIds.length === 0) {
      return 0;
    }

    const { count, error } = await supabase
      .from('temas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('id', uniqueTemaIds);

    throwIfSupabaseError(error, ERROR_CODES.TEMA_NOT_FOUND);
    return count ?? 0;
  }

  public async findTemasByIds(
    supabase: AppSupabaseClient,
    userId: string,
    temaIds: readonly string[]
  ): Promise<TemaRow[]> {
    const uniqueTemaIds = [...new Set(temaIds)];
    if (uniqueTemaIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('temas')
      .select(TEMA_SELECT)
      .eq('user_id', userId)
      .in('id', uniqueTemaIds)
      .order('nome', { ascending: true })
      .order('id', { ascending: true });

    throwIfSupabaseError(error, ERROR_CODES.TEMA_NOT_FOUND);
    return data ?? [];
  }

  public async createTema(
    supabase: AppSupabaseClient,
    userId: string,
    nome: string
  ): Promise<TemaRow> {
    const { data, error } = await supabase
      .from('temas')
      .insert({
        user_id: userId,
        nome,
      })
      .select(TEMA_SELECT)
      .single();

    throwIfSupabaseError(error, ERROR_CODES.TEMA_NOT_FOUND);
    if (!data) {
      throw new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, 500);
    }

    return data;
  }

  public async updateTemaNome(
    supabase: AppSupabaseClient,
    userId: string,
    id: string,
    nome: string
  ): Promise<TemaRow | null> {
    const { data, error } = await supabase
      .from('temas')
      .update({ nome })
      .eq('id', id)
      .eq('user_id', userId)
      .select(TEMA_SELECT)
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.TEMA_NOT_FOUND);
    return data;
  }

  public async deleteTema(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<{ id: string } | null> {
    const { data, error } = await supabase
      .from('temas')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.TEMA_NOT_FOUND);
    return data;
  }

  public async findReflexaoLousasByTemaPrincipal(
    supabase: AppSupabaseClient,
    userId: string,
    temaPrincipalId: string
  ): Promise<LousaStoragePaths[]> {
    const { data, error } = await supabase
      .from('reflexoes')
      .select(
        `lousa:lousas!reflexoes_lousa_id_fkey(id, scene_storage_path, preview_storage_path)`
      )
      .eq('user_id', userId)
      .eq('tema_principal_id', temaPrincipalId)
      .not('lousa_id', 'is', null);

    throwIfSupabaseError(error);

    const results: LousaStoragePaths[] = [];
    for (const row of (data ?? []) as Array<{
      lousa:
        | Pick<LousaRelationRow, 'id' | 'scene_storage_path' | 'preview_storage_path'>
        | Pick<LousaRelationRow, 'id' | 'scene_storage_path' | 'preview_storage_path'>[]
        | null;
    }>) {
      const lousaRow = unwrapSingleRelation(row.lousa);
      if (lousaRow) {
        results.push({
          id: lousaRow.id,
          sceneStoragePath: lousaRow.scene_storage_path,
          previewStoragePath: lousaRow.preview_storage_path,
        });
      }
    }

    return results;
  }

  public async registrarPraticaRpc(
    supabase: AppSupabaseClient,
    userId: string,
    temaIds: readonly string[],
    reviewMode: ReviewMode
  ): Promise<TemaRow[]> {
    const uniqueTemaIds = [...new Set(temaIds)];

    const { error: rpcError } = await supabase.rpc(
      'rpc_registrar_pratica_temas',
      {
        p_tema_ids: uniqueTemaIds,
        p_review_mode: reviewMode,
      }
    );

    throwIfSupabaseError(rpcError, ERROR_CODES.TEMA_NOT_FOUND);

    return this.findTemasByIds(supabase, userId, uniqueTemaIds);
  }

  public async countErrosPorTema(
    supabase: AppSupabaseClient,
    userId: string,
    temaId: string
  ): Promise<ErrosCountPorTemaResult> {
    const [pendentesRes, revisadosRes] = await Promise.all([
      supabase
        .from('caderno_erro_temas')
        .select('caderno_erro_id, caderno_erros!inner(id)', {
          count: 'exact',
          head: true,
        })
        .eq('tema_id', temaId)
        .eq('caderno_erros.user_id', userId)
        .eq('caderno_erros.status', 'PENDENTE'),
      supabase
        .from('caderno_erro_temas')
        .select('caderno_erro_id, caderno_erros!inner(id)', {
          count: 'exact',
          head: true,
        })
        .eq('tema_id', temaId)
        .eq('caderno_erros.user_id', userId)
        .eq('caderno_erros.status', 'REVISADO'),
    ]);

    throwIfSupabaseError(pendentesRes.error, ERROR_CODES.TEMA_NOT_FOUND);
    throwIfSupabaseError(revisadosRes.error, ERROR_CODES.TEMA_NOT_FOUND);

    return {
      pendentes: pendentesRes.count ?? 0,
      revisados: revisadosRes.count ?? 0,
    };
  }

  public async findReflexaoById(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<ReflexaoWithRelationsRow | null> {
    const { data, error } = await supabase
      .from('reflexoes')
      .select(REFLEXAO_SELECT)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.REFLEXAO_NOT_FOUND);
    return data as ReflexaoWithRelationsRow | null;
  }

  public async createReflexao(
    supabase: AppSupabaseClient,
    userId: string,
    params: CreateReflexaoRecordParams
  ): Promise<ReflexaoWithRelationsRow> {
    const { data: created, error: insertError } = await supabase
      .from('reflexoes')
      .insert({
        user_id: userId,
        tema_principal_id: params.temaPrincipalId,
        conteudo: params.conteudo,
        lousa_id: params.lousaId,
      })
      .select('id')
      .single();

    throwIfSupabaseError(insertError, ERROR_CODES.TEMA_NOT_FOUND);
    if (!created) {
      throw new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, 500);
    }

    if (params.temaConectadoIds.length > 0) {
      const linkRows = params.temaConectadoIds.map((temaConectadoId) => ({
        reflexao_id: created.id,
        tema_conectado_id: temaConectadoId,
      }));

      const { error: linkError } = await supabase
        .from('reflexao_temas_conectados')
        .insert(linkRows);

      if (linkError !== null) {
        await supabase
          .from('reflexoes')
          .delete()
          .eq('id', created.id)
          .eq('user_id', userId);
        throw mapSupabaseError(linkError, ERROR_CODES.TEMA_NOT_FOUND);
      }
    }

    const createdRow = await this.findReflexaoById(
      supabase,
      userId,
      created.id
    );
    if (!createdRow) {
      throw new AppError(ERROR_CODES.REFLEXAO_NOT_FOUND, 404);
    }

    return createdRow;
  }

  public async updateReflexao(
    supabase: AppSupabaseClient,
    userId: string,
    params: UpdateReflexaoRecordParams
  ): Promise<ReflexaoWithRelationsRow> {
    const {
      id,
      nextTemaPrincipalId,
      nextConteudo,
      nextLousaId,
      toAddConnectedIds,
      toRemoveConnectedIds,
    } = params;

    // Atualizamos os vínculos antes do update da reflexão para não disparar o trigger
    // cleanup_orphan_lousa prematuramente caso uma mutação de vínculo falhe.
    if (toAddConnectedIds.length > 0) {
      const linkRows = toAddConnectedIds.map((temaConectadoId) => ({
        reflexao_id: id,
        tema_conectado_id: temaConectadoId,
      }));

      const { error: addError } = await supabase
        .from('reflexao_temas_conectados')
        .insert(linkRows);

      if (addError !== null) {
        throw mapSupabaseError(addError, ERROR_CODES.TEMA_NOT_FOUND);
      }
    }

    if (toRemoveConnectedIds.length > 0) {
      const { error: removeError } = await supabase
        .from('reflexao_temas_conectados')
        .delete()
        .eq('reflexao_id', id)
        .in('tema_conectado_id', [...toRemoveConnectedIds]);

      if (removeError !== null) {
        if (toAddConnectedIds.length > 0) {
          await supabase
            .from('reflexao_temas_conectados')
            .delete()
            .eq('reflexao_id', id)
            .in('tema_conectado_id', [...toAddConnectedIds]);
        }

        throw mapSupabaseError(removeError, ERROR_CODES.REFLEXAO_NOT_FOUND);
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('reflexoes')
      .update({
        tema_principal_id: nextTemaPrincipalId,
        conteudo: nextConteudo,
        lousa_id: nextLousaId,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (updateError !== null || !updated) {
      if (toRemoveConnectedIds.length > 0) {
        await supabase.from('reflexao_temas_conectados').insert(
          toRemoveConnectedIds.map((temaConectadoId) => ({
            reflexao_id: id,
            tema_conectado_id: temaConectadoId,
          }))
        );
      }
      if (toAddConnectedIds.length > 0) {
        await supabase
          .from('reflexao_temas_conectados')
          .delete()
          .eq('reflexao_id', id)
          .in('tema_conectado_id', [...toAddConnectedIds]);
      }

      throwIfSupabaseError(updateError, ERROR_CODES.REFLEXAO_NOT_FOUND);
      throw new AppError(ERROR_CODES.REFLEXAO_NOT_FOUND, 404);
    }

    const updatedRow = await this.findReflexaoById(supabase, userId, id);
    if (!updatedRow) {
      throw new AppError(ERROR_CODES.REFLEXAO_NOT_FOUND, 404);
    }

    return updatedRow;
  }

  public async deleteReflexao(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<{ id: string } | null> {
    const { data, error } = await supabase
      .from('reflexoes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.REFLEXAO_NOT_FOUND);
    return data;
  }
}

export const temasRepository = new TemasRepository();
