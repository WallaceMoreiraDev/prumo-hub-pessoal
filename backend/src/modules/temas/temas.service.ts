import { ERROR_CODES, type PaginationMeta } from '@shared/types/api.types';
import type {
  CreateReflexaoInput,
  CreateTemaInput,
  RegistrarPraticaInput,
  TemasQuery,
  UpdateReflexaoInput,
  UpdateTemaInput,
} from '@shared/schemas/temas.schema';
import type {
  ReflexaoDto,
  TemaDetalheDto,
  TemaDto,
  TemaListItemDto,
  TemaSummaryDto,
} from '@shared/types/temas.types';
import type { AppSupabaseClient } from '../../config/supabase';
import { AppError } from '../../errors/AppError';
import { buildPaginationMeta } from '../../utils/response';
import {
  compareTemaByNome,
  mapReflexaoDto,
  mapTemaDetalheDto,
  mapTemaDto,
  mapTemaListItemDto,
  unwrapSingleRelation,
} from './temas.mapper';
import { temasRepository } from './temas.repository';

export interface ListTemasResult {
  items: TemaListItemDto[];
  pagination: PaginationMeta;
}

export class TemasService {
  private async ensureAllTemasExist(
    supabase: AppSupabaseClient,
    userId: string,
    temaIds: readonly string[]
  ): Promise<void> {
    const uniqueIds = [...new Set(temaIds)];
    if (uniqueIds.length === 0) {
      return;
    }

    const existingCount = await temasRepository.countTemasByIds(
      supabase,
      userId,
      uniqueIds
    );

    if (existingCount !== uniqueIds.length) {
      throw new AppError(ERROR_CODES.TEMA_NOT_FOUND, 404);
    }
  }

  public async listTemas(
    supabase: AppSupabaseClient,
    userId: string,
    query: TemasQuery
  ): Promise<ListTemasResult> {
    const { rows, total } = await temasRepository.listTemasPaginated(
      supabase,
      userId,
      query
    );

    const pagination = buildPaginationMeta(query.page, query.limit, total);

    if (rows.length === 0) {
      return { items: [], pagination };
    }

    const pageTemaIds = rows.map((row) => row.id);
    const reflexaoRows = await temasRepository.findReflexoesTouchingTemaIds(
      supabase,
      userId,
      pageTemaIds
    );
    const reflexoes = reflexaoRows.map(mapReflexaoDto);

    const metricsByTemaId = new Map<
      string,
      {
        reflexaoIds: Set<string>;
        conexaoIds: Set<string>;
        peerTemasMap: Map<string, TemaSummaryDto>;
      }
    >();

    for (const temaId of pageTemaIds) {
      metricsByTemaId.set(temaId, {
        reflexaoIds: new Set<string>(),
        conexaoIds: new Set<string>(),
        peerTemasMap: new Map<string, TemaSummaryDto>(),
      });
    }

    for (const reflexao of reflexoes) {
      const isConexao = reflexao.temasConectados.length >= 1;
      const participants: TemaSummaryDto[] = [
        reflexao.temaPrincipal,
        ...reflexao.temasConectados,
      ];

      for (const participant of participants) {
        const metrics = metricsByTemaId.get(participant.id);
        if (!metrics) {
          continue;
        }

        metrics.reflexaoIds.add(reflexao.id);

        if (isConexao) {
          metrics.conexaoIds.add(reflexao.id);

          for (const peer of participants) {
            if (peer.id !== participant.id) {
              metrics.peerTemasMap.set(peer.id, peer);
            }
          }
        }
      }
    }

    const items = rows.map((row) => {
      const metrics = metricsByTemaId.get(row.id);
      if (!metrics) {
        return mapTemaListItemDto(row);
      }

      const temasConectadosResumo = Array.from(
        metrics.peerTemasMap.values()
      ).sort(compareTemaByNome);

      return mapTemaListItemDto(row, {
        totalReflexoes: metrics.reflexaoIds.size,
        totalConexoes: metrics.conexaoIds.size,
        temasConectadosResumo,
      });
    });

    return { items, pagination };
  }

  public async getTemaById(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<TemaDetalheDto> {
    const temaRow = await temasRepository.findTemaById(supabase, userId, id);
    if (!temaRow) {
      throw new AppError(ERROR_CODES.TEMA_NOT_FOUND, 404);
    }

    const [reflexaoRows, errosCount] = await Promise.all([
      temasRepository.findReflexoesTouchingTemaIds(supabase, userId, [id]),
      temasRepository.countErrosPorTema(supabase, userId, id),
    ]);

    const reflexoes = reflexaoRows.map(mapReflexaoDto);
    const reflexoesProprias: ReflexaoDto[] = [];
    const conexoes: ReflexaoDto[] = [];

    for (const reflexao of reflexoes) {
      const hasConectados = reflexao.temasConectados.length >= 1;

      if (!hasConectados && reflexao.temaPrincipalId === id) {
        reflexoesProprias.push(reflexao);
        continue;
      }

      if (
        hasConectados &&
        (reflexao.temaPrincipalId === id ||
          reflexao.temasConectados.some((tema) => tema.id === id))
      ) {
        conexoes.push(reflexao);
      }
    }

    return mapTemaDetalheDto(
      temaRow,
      reflexoesProprias,
      conexoes,
      errosCount.pendentes,
      errosCount.revisados
    );
  }

  public async createTema(
    supabase: AppSupabaseClient,
    userId: string,
    input: CreateTemaInput
  ): Promise<TemaListItemDto> {
    const created = await temasRepository.createTema(
      supabase,
      userId,
      input.nome
    );
    return mapTemaListItemDto(created);
  }

  public async updateTema(
    supabase: AppSupabaseClient,
    userId: string,
    id: string,
    input: UpdateTemaInput
  ): Promise<TemaDto> {
    const updated = await temasRepository.updateTemaNome(
      supabase,
      userId,
      id,
      input.nome
    );
    if (!updated) {
      throw new AppError(ERROR_CODES.TEMA_NOT_FOUND, 404);
    }
    return mapTemaDto(updated);
  }

  public async deleteTema(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<{ id: string }> {
    const deleted = await temasRepository.deleteTema(supabase, userId, id);
    if (!deleted) {
      throw new AppError(ERROR_CODES.TEMA_NOT_FOUND, 404);
    }
    return { id: deleted.id };
  }

  public async registrarPratica(
    supabase: AppSupabaseClient,
    userId: string,
    input: RegistrarPraticaInput
  ): Promise<TemaDto[]> {
    const uniqueTemaIds = [...new Set(input.temaIds)];
    const updatedRows = await temasRepository.registrarPraticaRpc(
      supabase,
      userId,
      uniqueTemaIds,
      input.reviewMode
    );
    return updatedRows.map(mapTemaDto);
  }

  public async getReflexaoById(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<ReflexaoDto> {
    const row = await temasRepository.findReflexaoById(supabase, userId, id);
    if (!row) {
      throw new AppError(ERROR_CODES.REFLEXAO_NOT_FOUND, 404);
    }
    return mapReflexaoDto(row);
  }

  public async createReflexao(
    supabase: AppSupabaseClient,
    userId: string,
    input: CreateReflexaoInput
  ): Promise<ReflexaoDto> {
    const uniqueConnectedIds = [...new Set(input.temaConectadoIds)];

    if (uniqueConnectedIds.includes(input.temaPrincipalId)) {
      throw new AppError(ERROR_CODES.REFLEXAO_SELF_CONNECTION, 400);
    }

    await this.ensureAllTemasExist(supabase, userId, [
      input.temaPrincipalId,
      ...uniqueConnectedIds,
    ]);

    const createdRow = await temasRepository.createReflexao(supabase, userId, {
      temaPrincipalId: input.temaPrincipalId,
      temaConectadoIds: uniqueConnectedIds,
      conteudo: input.conteudo,
    });

    return mapReflexaoDto(createdRow);
  }

  public async updateReflexao(
    supabase: AppSupabaseClient,
    userId: string,
    id: string,
    input: UpdateReflexaoInput
  ): Promise<ReflexaoDto> {
    const existingRow = await temasRepository.findReflexaoById(
      supabase,
      userId,
      id
    );
    if (!existingRow) {
      throw new AppError(ERROR_CODES.REFLEXAO_NOT_FOUND, 404);
    }

    const currentConnectedIdSet = new Set<string>();
    for (const joinRow of existingRow.reflexao_temas_conectados ?? []) {
      const conectadoRow = unwrapSingleRelation(joinRow.tema_conectado);
      if (conectadoRow) {
        currentConnectedIdSet.add(conectadoRow.id);
      }
    }
    const currentConnectedIds = [...currentConnectedIdSet];

    const nextTemaPrincipalId =
      input.temaPrincipalId ?? existingRow.tema_principal_id;
    const nextConnectedIds =
      input.temaConectadoIds !== undefined
        ? [...new Set(input.temaConectadoIds)]
        : currentConnectedIds;
    const nextConteudo = input.conteudo ?? existingRow.conteudo;

    if (nextConnectedIds.includes(nextTemaPrincipalId)) {
      throw new AppError(ERROR_CODES.REFLEXAO_SELF_CONNECTION, 400);
    }

    if (
      input.temaPrincipalId !== undefined ||
      input.temaConectadoIds !== undefined
    ) {
      await this.ensureAllTemasExist(supabase, userId, [
        nextTemaPrincipalId,
        ...nextConnectedIds,
      ]);
    }

    const nextConnectedSet = new Set(nextConnectedIds);
    const toAddConnectedIds = nextConnectedIds.filter(
      (temaId) => !currentConnectedIdSet.has(temaId)
    );
    const toRemoveConnectedIds = currentConnectedIds.filter(
      (temaId) => !nextConnectedSet.has(temaId)
    );

    const updatedRow = await temasRepository.updateReflexao(supabase, userId, {
      id,
      previousTemaPrincipalId: existingRow.tema_principal_id,
      previousConteudo: existingRow.conteudo,
      nextTemaPrincipalId,
      nextConteudo,
      toAddConnectedIds,
      toRemoveConnectedIds,
    });

    return mapReflexaoDto(updatedRow);
  }

  public async deleteReflexao(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<{ id: string }> {
    const deleted = await temasRepository.deleteReflexao(
      supabase,
      userId,
      id
    );
    if (!deleted) {
      throw new AppError(ERROR_CODES.REFLEXAO_NOT_FOUND, 404);
    }
    return { id: deleted.id };
  }
}

export const temasService = new TemasService();
