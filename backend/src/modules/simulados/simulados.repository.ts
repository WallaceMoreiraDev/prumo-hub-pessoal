import { ERROR_CODES } from '@shared/types/api.types';
import type { Database } from '@shared/types/database.types';
import type { QuestaoResultado, SimuladoStatus } from '@shared/types/enums.types';
import type { SimuladosQuery } from '@shared/schemas/simulados.schema';
import type { EdgeLogger } from '../../config/logger';
import type { AppSupabaseClient } from '../../config/supabase';
import { AppError } from '../../errors/AppError';
import {
  mapSupabaseStorageError,
  throwIfSupabaseError,
  type SupabaseStorageErrorLike,
} from '../../utils/supabaseErrorMapper';
import { unwrapSingleRelation } from '../temas/temas.mapper';
import type {
  SimuladoListMetrics,
  SimuladoPensamentoRow,
  SimuladoQuestaoWithRelationsRow,
  SimuladoRow,
  SimuladoWithRelationsRow,
} from './simulados.mapper';

export const SIMULADO_PDF_BUCKET = 'simulado-pdfs';

const IN_CLAUSE_CHUNK_SIZE = 50;

const SIMULADO_SUMMARY_SELECT = `
  id,
  user_id,
  titulo,
  duracao_configurada_segundos,
  tempo_gasto_segundos,
  pdf_storage_path,
  status,
  started_at,
  finished_at,
  created_at,
  updated_at
` as const;

const SIMULADO_QUESTAO_SELECT = `
  id,
  user_id,
  simulado_id,
  numero_questao,
  titulo_questao,
  ordem,
  resultado,
  observacao_pos_revisao,
  created_at,
  updated_at,
  simulado_questao_temas(
    tema:temas!simulado_questao_temas_tema_id_fkey(
      id,
      nome,
      last_reviewed_at,
      last_review_mode
    )
  ),
  simulado_pensamentos!simulado_pensamentos_simulado_questao_id_fkey(
    id,
    user_id,
    simulado_questao_id,
    descricao,
    tempo_decorrido_segundos,
    created_at,
    updated_at
  )
` as const;

const SIMULADO_DETALHE_SELECT = `
  id,
  user_id,
  titulo,
  duracao_configurada_segundos,
  tempo_gasto_segundos,
  pdf_storage_path,
  status,
  started_at,
  finished_at,
  created_at,
  updated_at,
  simulado_questoes!simulado_questoes_simulado_id_fkey(
    id,
    user_id,
    simulado_id,
    numero_questao,
    titulo_questao,
    ordem,
    resultado,
    observacao_pos_revisao,
    created_at,
    updated_at,
    simulado_questao_temas(
      tema:temas!simulado_questao_temas_tema_id_fkey(
        id,
        nome,
        last_reviewed_at,
        last_review_mode
      )
    ),
    simulado_pensamentos!simulado_pensamentos_simulado_questao_id_fkey(
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

const SIMULADO_PENSAMENTO_SELECT = `
  id,
  user_id,
  simulado_questao_id,
  descricao,
  tempo_decorrido_segundos,
  created_at,
  updated_at
` as const;

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

export interface PaginatedSimuladosResult {
  rows: SimuladoRow[];
  total: number;
}

export interface PensamentoWithQuestaoParent extends SimuladoPensamentoRow {
  simulado_questao:
    | { id: string; simulado_id: string }
    | Array<{ id: string; simulado_id: string }>
    | null;
}

export interface CreateSignedUrlOutcome {
  signedUrl: string | null;
  error: SupabaseStorageErrorLike | null;
}

export class SimuladosRepository {
  public async listPaginated(
    supabase: AppSupabaseClient,
    userId: string,
    query: SimuladosQuery
  ): Promise<PaginatedSimuladosResult> {
    const { page, limit, status, search, sortBy } = query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const normalizedSearch = search && search.length > 0 ? search : undefined;

    let dataQuery = supabase
      .from('simulados')
      .select(SIMULADO_SUMMARY_SELECT, { count: 'exact' })
      .eq('user_id', userId);

    if (status !== undefined) {
      dataQuery = dataQuery.eq('status', status);
    }

    if (normalizedSearch !== undefined) {
      dataQuery = dataQuery.ilike(
        'titulo',
        `%${escapeLikePattern(normalizedSearch)}%`
      );
    }

    dataQuery = dataQuery
      .order('created_at', { ascending: sortBy === 'oldest' })
      .order('id', { ascending: true });

    const { data, error, count } = await dataQuery.range(from, to);

    if (error?.code === 'PGRST103') {
      let countQuery = supabase
        .from('simulados')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (status !== undefined) {
        countQuery = countQuery.eq('status', status);
      }

      if (normalizedSearch !== undefined) {
        countQuery = countQuery.ilike(
          'titulo',
          `%${escapeLikePattern(normalizedSearch)}%`
        );
      }

      const { count: fallbackCount, error: countError } = await countQuery;
      throwIfSupabaseError(countError, ERROR_CODES.SIMULADO_NOT_FOUND);

      return {
        rows: [],
        total: fallbackCount ?? 0,
      };
    }

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_NOT_FOUND);

    return {
      rows: (data ?? []) as SimuladoRow[],
      total: count ?? 0,
    };
  }

  public async getBatchListMetrics(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoIds: readonly string[]
  ): Promise<Map<string, SimuladoListMetrics>> {
    const metricsMap = new Map<string, SimuladoListMetrics>();
    const uniqueSimuladoIds = [...new Set(simuladoIds)];

    if (uniqueSimuladoIds.length === 0) {
      return metricsMap;
    }

    for (const simuladoId of uniqueSimuladoIds) {
      metricsMap.set(simuladoId, {
        totalQuestoes: 0,
        totalQuestoesClassificadas: 0,
        totalAcertos: 0,
        totalParciais: 0,
        totalErros: 0,
        totalPensamentos: 0,
      });
    }

    const simuladoChunks = chunkArray(uniqueSimuladoIds, IN_CLAUSE_CHUNK_SIZE);
    const questoesResponses = await Promise.all(
      simuladoChunks.map((chunk) =>
        supabase
          .from('simulado_questoes')
          .select('id, simulado_id, resultado')
          .eq('user_id', userId)
          .in('simulado_id', chunk)
      )
    );

    const questaoToSimulado = new Map<string, string>();
    const questaoIds: string[] = [];

    for (const response of questoesResponses) {
      throwIfSupabaseError(response.error, ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND);
      for (const row of response.data ?? []) {
        questaoIds.push(row.id);
        questaoToSimulado.set(row.id, row.simulado_id);

        const metrics = metricsMap.get(row.simulado_id);
        if (!metrics) {
          continue;
        }

        metrics.totalQuestoes += 1;
        if (row.resultado !== null) {
          metrics.totalQuestoesClassificadas += 1;
          if (row.resultado === 'ACERTEI') {
            metrics.totalAcertos += 1;
          } else if (row.resultado === 'PARCIAL') {
            metrics.totalParciais += 1;
          } else if (row.resultado === 'ERREI') {
            metrics.totalErros += 1;
          }
        }
      }
    }

    if (questaoIds.length === 0) {
      return metricsMap;
    }

    const questaoChunks = chunkArray(questaoIds, IN_CLAUSE_CHUNK_SIZE);
    const pensamentosResponses = await Promise.all(
      questaoChunks.map((chunk) =>
        supabase
          .from('simulado_pensamentos')
          .select('id, simulado_questao_id')
          .eq('user_id', userId)
          .in('simulado_questao_id', chunk)
      )
    );

    for (const response of pensamentosResponses) {
      throwIfSupabaseError(
        response.error,
        ERROR_CODES.SIMULADO_PENSAMENTO_NOT_FOUND
      );
      for (const row of response.data ?? []) {
        const simuladoId = questaoToSimulado.get(row.simulado_questao_id);
        if (!simuladoId) {
          continue;
        }
        const metrics = metricsMap.get(simuladoId);
        if (metrics) {
          metrics.totalPensamentos += 1;
        }
      }
    }

    return metricsMap;
  }

  public async findSummaryById(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<SimuladoRow | null> {
    const { data, error } = await supabase
      .from('simulados')
      .select(SIMULADO_SUMMARY_SELECT)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_NOT_FOUND);
    return data as SimuladoRow | null;
  }

  public async findDetalheById(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<SimuladoWithRelationsRow | null> {
    const { data, error } = await supabase
      .from('simulados')
      .select(SIMULADO_DETALHE_SELECT)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_NOT_FOUND);
    return data as SimuladoWithRelationsRow | null;
  }

  public async createSimulado(
    supabase: AppSupabaseClient,
    userId: string,
    params: { titulo: string; duracaoConfiguradaSegundos: number }
  ): Promise<SimuladoRow> {
    const { data, error } = await supabase
      .from('simulados')
      .insert({
        user_id: userId,
        titulo: params.titulo,
        duracao_configurada_segundos: params.duracaoConfiguradaSegundos,
        tempo_gasto_segundos: 0,
        pdf_storage_path: null,
        status: 'PREPARACAO',
        started_at: null,
        finished_at: null,
      })
      .select(SIMULADO_SUMMARY_SELECT)
      .single();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_NOT_FOUND);
    if (!data) {
      throw new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, 500);
    }

    return data as SimuladoRow;
  }

  public async updateSimuladoMetadata(
    supabase: AppSupabaseClient,
    userId: string,
    id: string,
    expectedStatus: SimuladoStatus,
    fields: { titulo?: string; duracao_configurada_segundos?: number }
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('simulados')
      .update(fields)
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', expectedStatus)
      .select('id')
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_NOT_FOUND);
    return data !== null;
  }

  public async countQuestoesBySimulado(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoId: string
  ): Promise<number> {
    const { count, error } = await supabase
      .from('simulado_questoes')
      .select('id', { count: 'exact', head: true })
      .eq('simulado_id', simuladoId)
      .eq('user_id', userId);

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_NOT_FOUND);
    return count ?? 0;
  }

  public async transitionToEmAndamento(
    supabase: AppSupabaseClient,
    userId: string,
    id: string,
    startedAtIso: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('simulados')
      .update({
        status: 'EM_ANDAMENTO',
        started_at: startedAtIso,
        tempo_gasto_segundos: 0,
        finished_at: null,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'PREPARACAO')
      .select('id')
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_NOT_FOUND);
    return data !== null;
  }

  public async transitionToFinalizado(
    supabase: AppSupabaseClient,
    userId: string,
    id: string,
    params: {
      finishedAtIso: string;
      tempoGastoSegundos: number;
      clampedStartedAtIso?: string;
    }
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('simulados')
      .update({
        status: 'FINALIZADO',
        finished_at: params.finishedAtIso,
        tempo_gasto_segundos: params.tempoGastoSegundos,
        ...(params.clampedStartedAtIso !== undefined
          ? { started_at: params.clampedStartedAtIso }
          : {}),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'EM_ANDAMENTO')
      .select('id')
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_NOT_FOUND);
    return data !== null;
  }

  public async deleteSimulado(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<{ id: string; pdf_storage_path: string | null } | null> {
    const { data, error } = await supabase
      .from('simulados')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id, pdf_storage_path')
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_NOT_FOUND);
    return data;
  }

  public async uploadPdf(
    supabase: AppSupabaseClient,
    storagePath: string,
    fileBuffer: ArrayBuffer
  ): Promise<void> {
    const { error } = await supabase.storage
      .from(SIMULADO_PDF_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error !== null) {
      throw mapSupabaseStorageError(error);
    }
  }

  public async updatePdfStoragePath(
    supabase: AppSupabaseClient,
    userId: string,
    id: string,
    storagePath: string | null,
    expectedStatus: SimuladoStatus
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('simulados')
      .update({
        pdf_storage_path: storagePath,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', expectedStatus)
      .select('id')
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_NOT_FOUND);
    return data !== null;
  }

  public async createPdfSignedUrl(
    supabase: AppSupabaseClient,
    storagePath: string,
    expiresInSeconds: number
  ): Promise<CreateSignedUrlOutcome> {
    const { data, error } = await supabase.storage
      .from(SIMULADO_PDF_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error !== null) {
      return {
        signedUrl: null,
        error,
      };
    }

    return {
      signedUrl: data?.signedUrl ?? null,
      error: null,
    };
  }

  public async removePdfBestEffort(
    supabase: AppSupabaseClient,
    logger: EdgeLogger,
    storagePath: string,
    context: { simuladoId: string; userId: string; reason: string }
  ): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(SIMULADO_PDF_BUCKET)
        .remove([storagePath]);

      if (error !== null) {
        logger.warn('Falha best-effort ao remover PDF do Storage', {
          simuladoId: context.simuladoId,
          userId: context.userId,
          reason: context.reason,
          storagePath,
          storageError: error.message,
          storageStatus: error.status,
          storageStatusCode: error.statusCode,
        });
      }
    } catch (err) {
      logger.warn('Exceção best-effort ao remover PDF do Storage', {
        simuladoId: context.simuladoId,
        userId: context.userId,
        reason: context.reason,
        storagePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  public async getNextQuestaoOrdem(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoId: string
  ): Promise<number> {
    const { data, error } = await supabase
      .from('simulado_questoes')
      .select('ordem')
      .eq('simulado_id', simuladoId)
      .eq('user_id', userId)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND);
    return (data?.ordem ?? 0) + 1;
  }

  public async findQuestaoById(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoId: string,
    questaoId: string
  ): Promise<SimuladoQuestaoWithRelationsRow | null> {
    const { data, error } = await supabase
      .from('simulado_questoes')
      .select(SIMULADO_QUESTAO_SELECT)
      .eq('id', questaoId)
      .eq('simulado_id', simuladoId)
      .eq('user_id', userId)
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND);
    return data as SimuladoQuestaoWithRelationsRow | null;
  }

  public async questaoExistsInSimulado(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoId: string,
    questaoId: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('simulado_questoes')
      .select('id')
      .eq('id', questaoId)
      .eq('simulado_id', simuladoId)
      .eq('user_id', userId)
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND);
    return data !== null;
  }

  public async createQuestao(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoId: string,
    params: {
      numeroQuestao: string;
      tituloQuestao: string;
      ordem: number;
    }
  ): Promise<SimuladoQuestaoWithRelationsRow> {
    const { data: created, error } = await supabase
      .from('simulado_questoes')
      .insert({
        user_id: userId,
        simulado_id: simuladoId,
        numero_questao: params.numeroQuestao,
        titulo_questao: params.tituloQuestao,
        ordem: params.ordem,
      })
      .select('id')
      .single();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND);
    if (!created) {
      throw new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, 500);
    }

    const hydrated = await this.findQuestaoById(
      supabase,
      userId,
      simuladoId,
      created.id
    );
    if (!hydrated) {
      throw new AppError(ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND, 404);
    }

    return hydrated;
  }

  public async updateQuestao(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoId: string,
    questaoId: string,
    fields: {
      numero_questao?: string;
      titulo_questao?: string;
      ordem?: number;
    }
  ): Promise<SimuladoQuestaoWithRelationsRow | null> {
    const { data: updated, error } = await supabase
      .from('simulado_questoes')
      .update(fields)
      .eq('id', questaoId)
      .eq('simulado_id', simuladoId)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND);
    if (!updated) {
      return null;
    }

    return this.findQuestaoById(supabase, userId, simuladoId, questaoId);
  }

  public async deleteQuestao(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoId: string,
    questaoId: string
  ): Promise<{ id: string } | null> {
    const { data, error } = await supabase
      .from('simulado_questoes')
      .delete()
      .eq('id', questaoId)
      .eq('simulado_id', simuladoId)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND);
    return data;
  }

  public async classificarQuestaoRpc(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoId: string,
    questaoId: string,
    params: {
      resultado: QuestaoResultado;
      temaIds: readonly string[];
      observacaoPosRevisao: string | null;
    }
  ): Promise<SimuladoQuestaoWithRelationsRow> {
    const rpcArgs: Database['public']['Functions']['rpc_classificar_questao_simulado']['Args'] =
      {
        p_simulado_questao_id: questaoId,
        p_resultado: params.resultado,
        p_tema_ids: [...params.temaIds],
        ...(params.observacaoPosRevisao !== null
          ? { p_observacao_pos_revisao: params.observacaoPosRevisao }
          : {}),
      };

    const { error: rpcError } = await supabase.rpc(
      'rpc_classificar_questao_simulado',
      rpcArgs
    );

    throwIfSupabaseError(rpcError, ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND);

    const hydrated = await this.findQuestaoById(
      supabase,
      userId,
      simuladoId,
      questaoId
    );
    if (!hydrated) {
      throw new AppError(ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND, 404);
    }

    return hydrated;
  }

  public async findPensamentoWithSimulado(
    supabase: AppSupabaseClient,
    userId: string,
    pensamentoId: string
  ): Promise<PensamentoWithQuestaoParent | null> {
    const { data, error } = await supabase
      .from('simulado_pensamentos')
      .select(
        `
          ${SIMULADO_PENSAMENTO_SELECT},
          simulado_questao:simulado_questoes!simulado_pensamentos_simulado_questao_id_fkey(
            id,
            simulado_id
          )
        `
      )
      .eq('id', pensamentoId)
      .eq('user_id', userId)
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_PENSAMENTO_NOT_FOUND);
    if (!data) {
      return null;
    }

    const row = data as PensamentoWithQuestaoParent;
    const questao = unwrapSingleRelation(row.simulado_questao);
    if (!questao) {
      return null;
    }

    return row;
  }

  public async createPensamento(
    supabase: AppSupabaseClient,
    userId: string,
    params: {
      simuladoQuestaoId: string;
      descricao: string;
      tempoDecorridoSegundos: number | null;
    }
  ): Promise<SimuladoPensamentoRow> {
    const { data, error } = await supabase
      .from('simulado_pensamentos')
      .insert({
        user_id: userId,
        simulado_questao_id: params.simuladoQuestaoId,
        descricao: params.descricao,
        tempo_decorrido_segundos: params.tempoDecorridoSegundos,
      })
      .select(SIMULADO_PENSAMENTO_SELECT)
      .single();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_PENSAMENTO_NOT_FOUND);
    if (!data) {
      throw new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, 500);
    }

    return data as SimuladoPensamentoRow;
  }

  public async updatePensamento(
    supabase: AppSupabaseClient,
    userId: string,
    pensamentoId: string,
    fields: {
      simulado_questao_id?: string;
      descricao?: string;
      tempo_decorrido_segundos?: number | null;
    }
  ): Promise<SimuladoPensamentoRow | null> {
    const { data, error } = await supabase
      .from('simulado_pensamentos')
      .update(fields)
      .eq('id', pensamentoId)
      .eq('user_id', userId)
      .select(SIMULADO_PENSAMENTO_SELECT)
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_PENSAMENTO_NOT_FOUND);
    return data as SimuladoPensamentoRow | null;
  }

  public async deletePensamento(
    supabase: AppSupabaseClient,
    userId: string,
    pensamentoId: string
  ): Promise<{ id: string } | null> {
    const { data, error } = await supabase
      .from('simulado_pensamentos')
      .delete()
      .eq('id', pensamentoId)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    throwIfSupabaseError(error, ERROR_CODES.SIMULADO_PENSAMENTO_NOT_FOUND);
    return data;
  }
}

export const simuladosRepository = new SimuladosRepository();
