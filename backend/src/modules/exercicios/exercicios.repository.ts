import { ERROR_CODES } from '@shared/types/api.types';
import type { ReviewMode } from '@shared/types/enums.types';
import type {
  CreateExercicioAvulsoInput,
  ListExerciciosQuery,
  UpdateExercicioAvulsoInput,
} from '@shared/schemas/exercicios.schema';
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
  type TemaSummaryRow,
} from '../temas/temas.mapper';
import type {
  ExercicioRow,
  ExercicioWithRelationsRow,
} from './exercicios.mapper';

export const EXERCICIO_SELECT = `
  id,
  user_id,
  titulo,
  enunciado,
  link_externo,
  observacao,
  duracao_segundos,
  desfecho,
  lousa_id,
  created_at,
  updated_at,
  lousa:lousas!exercicios_avulsos_lousa_id_fkey(
    ${LOUSA_RELATION_SELECT}
  ),
  exercicio_temas(
    tema:temas!exercicio_temas_tema_id_fkey(
      id,
      nome,
      last_reviewed_at,
      last_review_mode
    )
  )
` as const;

export interface PaginatedExerciciosResult {
  rows: ExercicioWithRelationsRow[];
  total: number;
}

export interface ExercicioResumoRow {
  id: string;
  titulo: string;
  duracao_segundos: number;
  desfecho: ReviewMode | null;
  lousa_id: string | null;
  created_at: string;
  exercicio_temas: Array<{
    tema: TemaSummaryRow | TemaSummaryRow[] | null;
  }> | null;
}

export interface ReflexaoResumoRow {
  id: string;
  conteudo: string | null;
  lousa_id: string | null;
  created_at: string;
  tema_principal: TemaSummaryRow | TemaSummaryRow[] | null;
  reflexao_temas_conectados: Array<{
    tema_conectado: TemaSummaryRow | TemaSummaryRow[] | null;
  }> | null;
}

export interface ResumoPeriodoRawData {
  exercicios: ExercicioResumoRow[];
  reflexoes: ReflexaoResumoRow[];
}

export class ExerciciosRepository {
  public async createViaRpc(
    supabase: AppSupabaseClient,
    userId: string,
    input: CreateExercicioAvulsoInput
  ): Promise<ExercicioWithRelationsRow> {
    const uniqueTemaIds = [...new Set(input.temaIds)];

    const { data: created, error } = await supabase.rpc(
      'rpc_salvar_exercicio_avulso',
      {
        p_titulo: input.titulo,
        p_tema_ids: uniqueTemaIds,
        p_enunciado: input.enunciado ?? undefined,
        p_link_externo: input.linkExterno ?? undefined,
        p_observacao: input.observacao ?? undefined,
        p_duracao_segundos: input.duracaoSegundos,
        p_desfecho: input.desfecho ?? undefined,
        p_lousa_id: input.lousaId ?? undefined,
      }
    );

    throwIfSupabaseError(error, ERROR_CODES.VALIDATION_ERROR);
    if (!created) {
      throw new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, 500);
    }

    const fullRow = await this.findById(supabase, created.id, userId);
    if (!fullRow) {
      throw new AppError(ERROR_CODES.EXERCICIO_NOT_FOUND, 404);
    }

    return fullRow;
  }

  public async findById(
    supabase: AppSupabaseClient,
    id: string,
    userId: string
  ): Promise<ExercicioWithRelationsRow | null> {
    const { data, error } = await supabase
      .from('exercicios_avulsos')
      .select(EXERCICIO_SELECT)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.EXERCICIO_NOT_FOUND);
    return data as ExercicioWithRelationsRow | null;
  }

  public async findMany(
    supabase: AppSupabaseClient,
    userId: string,
    query: ListExerciciosQuery
  ): Promise<PaginatedExerciciosResult> {
    let exercicioIdsFilteredByTema: string[] | null = null;

    if (query.temaId) {
      const { data: linkData, error: linkError } = await supabase
        .from('exercicio_temas')
        .select('exercicio_id')
        .eq('tema_id', query.temaId);

      throwIfSupabaseError(linkError);

      const ids = (linkData ?? []).map((row) => row.exercicio_id);
      if (ids.length === 0) {
        return { rows: [], total: 0 };
      }
      exercicioIdsFilteredByTema = ids;
    }

    let qb = supabase
      .from('exercicios_avulsos')
      .select(EXERCICIO_SELECT, { count: 'exact' })
      .eq('user_id', userId);

    if (query.desfecho) {
      qb = qb.eq('desfecho', query.desfecho);
    }

    if (exercicioIdsFilteredByTema) {
      qb = qb.in('id', exercicioIdsFilteredByTema);
    }

    if (query.search && query.search.trim().length > 0) {
      const term = query.search.trim().replace(/[\\%_]/g, (match) => `\\${match}`);
      const pattern = `%${term}%`;
      qb = qb.or(
        `titulo.ilike.${pattern},enunciado.ilike.${pattern},observacao.ilike.${pattern}`
      );
    }

    const offset = (query.page - 1) * query.limit;
    qb = qb
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + query.limit - 1);

    const { data, count, error } = await qb;
    throwIfSupabaseError(error, ERROR_CODES.EXERCICIO_NOT_FOUND);

    return {
      rows: (data ?? []) as ExercicioWithRelationsRow[],
      total: count ?? 0,
    };
  }

  public async update(
    supabase: AppSupabaseClient,
    id: string,
    userId: string,
    input: UpdateExercicioAvulsoInput,
    existingRow: ExercicioWithRelationsRow
  ): Promise<ExercicioWithRelationsRow> {
    const updatePayload: Partial<ExercicioRow> = {};

    if (input.titulo !== undefined) updatePayload.titulo = input.titulo;
    if (input.enunciado !== undefined) updatePayload.enunciado = input.enunciado;
    if (input.linkExterno !== undefined) updatePayload.link_externo = input.linkExterno;
    if (input.observacao !== undefined) updatePayload.observacao = input.observacao;
    if (input.duracaoSegundos !== undefined) updatePayload.duracao_segundos = input.duracaoSegundos;
    if (input.desfecho !== undefined) updatePayload.desfecho = input.desfecho;
    if (input.lousaId !== undefined) updatePayload.lousa_id = input.lousaId;

    let targetTemaIds: string[] = [];
    if (input.temaIds !== undefined) {
      targetTemaIds = [...new Set(input.temaIds)];
    } else {
      for (const joinRow of existingRow.exercicio_temas ?? []) {
        const tema = unwrapSingleRelation(joinRow.tema);
        if (tema) targetTemaIds.push(tema.id);
      }
    }

    // Se temaIds foi informado, atualiza a associativa exercicio_temas
    if (input.temaIds !== undefined) {
      const { error: deleteLinksError } = await supabase
        .from('exercicio_temas')
        .delete()
        .eq('exercicio_id', id);

      throwIfSupabaseError(deleteLinksError);

      if (targetTemaIds.length > 0) {
        const linkRows = targetTemaIds.map((tId) => ({
          exercicio_id: id,
          tema_id: tId,
        }));
        const { error: insertLinksError } = await supabase
          .from('exercicio_temas')
          .insert(linkRows);

        throwIfSupabaseError(insertLinksError, ERROR_CODES.TEMA_NOT_FOUND);
      }
    }

    // Atualiza tabela principal exercicios_avulsos
    if (Object.keys(updatePayload).length > 0) {
      const { data: updated, error: updateError } = await supabase
        .from('exercicios_avulsos')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();

      throwIfSupabaseError(updateError, ERROR_CODES.EXERCICIO_NOT_FOUND);
      if (!updated) {
        throw new AppError(ERROR_CODES.EXERCICIO_NOT_FOUND, 404);
      }
    }

    // Se desfecho for alterado para valor não-nulo, atualiza temas vinculados
    const nextDesfecho = input.desfecho !== undefined ? input.desfecho : existingRow.desfecho;
    if (
      input.desfecho !== undefined &&
      input.desfecho !== null &&
      input.desfecho !== existingRow.desfecho &&
      targetTemaIds.length > 0
    ) {
      const { error: temaUpdateError } = await supabase
        .from('temas')
        .update({
          last_reviewed_at: new Date().toISOString(),
          last_review_mode: input.desfecho,
        })
        .eq('user_id', userId)
        .in('id', targetTemaIds);

      throwIfSupabaseError(temaUpdateError, ERROR_CODES.TEMA_NOT_FOUND);
    }

    const fullRow = await this.findById(supabase, id, userId);
    if (!fullRow) {
      throw new AppError(ERROR_CODES.EXERCICIO_NOT_FOUND, 404);
    }

    return fullRow;
  }

  public async delete(
    supabase: AppSupabaseClient,
    id: string,
    userId: string
  ): Promise<{ id: string }> {
    const { data, error } = await supabase
      .from('exercicios_avulsos')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.EXERCICIO_NOT_FOUND);
    if (!data) {
      throw new AppError(ERROR_CODES.EXERCICIO_NOT_FOUND, 404);
    }

    return { id: data.id };
  }

  public async findResumoPeriodoData(
    supabase: AppSupabaseClient,
    userId: string,
    startIso: string,
    endIso: string
  ): Promise<ResumoPeriodoRawData> {
    const [exerciciosRes, reflexoesRes] = await Promise.all([
      supabase
        .from('exercicios_avulsos')
        .select(`
          id,
          titulo,
          duracao_segundos,
          desfecho,
          lousa_id,
          created_at,
          exercicio_temas(
            tema:temas!exercicio_temas_tema_id_fkey(
              id,
              nome,
              last_reviewed_at,
              last_review_mode
            )
          )
        `)
        .eq('user_id', userId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false }),

      supabase
        .from('reflexoes')
        .select(`
          id,
          conteudo,
          lousa_id,
          created_at,
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
        `)
        .eq('user_id', userId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false }),
    ]);

    throwIfSupabaseError(exerciciosRes.error);
    throwIfSupabaseError(reflexoesRes.error);

    return {
      exercicios: (exerciciosRes.data ?? []) as unknown as ExercicioResumoRow[],
      reflexoes: (reflexoesRes.data ?? []) as unknown as ReflexaoResumoRow[],
    };
  }
}

export const exerciciosRepository = new ExerciciosRepository();
