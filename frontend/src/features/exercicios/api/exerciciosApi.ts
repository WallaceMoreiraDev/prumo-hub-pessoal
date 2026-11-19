import type {
  CreateExercicioAvulsoInput,
  EstudosResumoQuery,
  ListExerciciosQuery,
  UpdateExercicioAvulsoInput,
} from '@shared/schemas/exercicios.schema';
import type { ApiSuccessResponse } from '@shared/types/api.types';
import type {
  EstudoExportIaDto,
  EstudosResumoPeriodoDto,
  ExercicioAvulsoDetalheDto,
  ExercicioAvulsoSummaryDto,
} from '@shared/types/exercicios.types';
import { apiClient, type QueryParams } from '@/lib/apiClient';

export const exerciciosApi = {
  async create(
    payload: CreateExercicioAvulsoInput
  ): Promise<ExercicioAvulsoDetalheDto> {
    return apiClient.post<ExercicioAvulsoDetalheDto>('/exercicios', payload);
  },

  async list(
    query: Partial<ListExerciciosQuery> = {},
    signal?: AbortSignal
  ): Promise<ApiSuccessResponse<ExercicioAvulsoSummaryDto[]>> {
    const response = await apiClient.getPaginated<ExercicioAvulsoSummaryDto[]>(
      '/exercicios',
      {
        query: {
          page: query.page ?? 1,
          limit: query.limit ?? 20,
          search: query.search?.trim() || undefined,
          temaId: query.temaId,
          desfecho: query.desfecho,
        } as QueryParams,
        signal,
      }
    );

    return {
      success: true,
      data: response.data,
      meta: response.meta,
    };
  },

  async getById(
    id: string,
    signal?: AbortSignal
  ): Promise<ExercicioAvulsoDetalheDto> {
    return apiClient.get<ExercicioAvulsoDetalheDto>(`/exercicios/${id}`, {
      signal,
    });
  },

  async update(
    id: string,
    payload: UpdateExercicioAvulsoInput
  ): Promise<ExercicioAvulsoDetalheDto> {
    return apiClient.patch<ExercicioAvulsoDetalheDto>(
      `/exercicios/${id}`,
      payload
    );
  },

  async delete(id: string): Promise<{ id: string }> {
    return apiClient.delete<{ id: string }>(`/exercicios/${id}`);
  },

  async getResumo(
    query: EstudosResumoQuery,
    signal?: AbortSignal
  ): Promise<EstudosResumoPeriodoDto> {
    return apiClient.get<EstudosResumoPeriodoDto>('/exercicios/resumo', {
      query: {
        periodo: query.periodo,
        data: query.data,
        dataInicio: query.dataInicio,
        dataFim: query.dataFim,
      } as QueryParams,
      signal,
    });
  },

  async getExportIa(
    query: EstudosResumoQuery,
    signal?: AbortSignal
  ): Promise<EstudoExportIaDto> {
    return apiClient.get<EstudoExportIaDto>('/exercicios/export-ia', {
      query: {
        periodo: query.periodo,
        data: query.data,
        dataInicio: query.dataInicio,
        dataFim: query.dataFim,
      } as QueryParams,
      signal,
    });
  },
};
