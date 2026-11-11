import type {
  ClassificarQuestaoSimuladoInput,
  CreateSimuladoInput,
  CreateSimuladoPensamentoInput,
  CreateSimuladoQuestaoInput,
  FinalizarSimuladoInput,
  SimuladosQuery,
  UpdateSimuladoInput,
  UpdateSimuladoPensamentoInput,
  UpdateSimuladoQuestaoInput,
} from '@shared/schemas/simulados.schema';
import type { PaginationMeta } from '@shared/types/api.types';
import type {
  SimuladoDetalheDto,
  SimuladoExportIaDto,
  SimuladoListItemDto,
  SimuladoPdfSignedUrlDto,
  SimuladoPensamentoDto,
  SimuladoQuestaoDto,
} from '@shared/types/simulados.types';
import { apiClient } from '@/lib/apiClient';

export type SimuladosListQueryParams = Partial<SimuladosQuery>;

export interface ListSimuladosResponse {
  items: SimuladoListItemDto[];
  pagination: PaginationMeta;
}

export const simuladosApi = {
  async listSimulados(
    query: SimuladosListQueryParams = {},
    signal?: AbortSignal
  ): Promise<ListSimuladosResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const response = await apiClient.getPaginated<SimuladoListItemDto[]>(
      '/simulados',
      {
        query: {
          page,
          limit,
          status: query.status,
          search: query.search?.trim() || undefined,
          sortBy: query.sortBy ?? 'recent',
        },
        signal,
      }
    );

    const pagination: PaginationMeta = response.meta.pagination ?? {
      page,
      limit,
      total: response.data.length,
      totalPages: response.data.length > 0 ? 1 : 0,
    };

    return {
      items: response.data,
      pagination,
    };
  },

  async getSimuladoById(
    id: string,
    signal?: AbortSignal
  ): Promise<SimuladoDetalheDto> {
    return apiClient.get<SimuladoDetalheDto>(`/simulados/${id}`, { signal });
  },

  async createSimulado(input: CreateSimuladoInput): Promise<SimuladoDetalheDto> {
    return apiClient.post<SimuladoDetalheDto>('/simulados', input);
  },

  async updateSimulado(
    id: string,
    input: UpdateSimuladoInput
  ): Promise<SimuladoDetalheDto> {
    return apiClient.patch<SimuladoDetalheDto>(`/simulados/${id}`, input);
  },

  async deleteSimulado(id: string): Promise<{ id: string }> {
    return apiClient.delete<{ id: string }>(`/simulados/${id}`);
  },

  async iniciarSimulado(id: string): Promise<SimuladoDetalheDto> {
    return apiClient.post<SimuladoDetalheDto>(`/simulados/${id}/iniciar`);
  },

  async finalizarSimulado(
    id: string,
    input: FinalizarSimuladoInput
  ): Promise<SimuladoDetalheDto> {
    return apiClient.post<SimuladoDetalheDto>(
      `/simulados/${id}/finalizar`,
      input
    );
  },

  async uploadSimuladoPdf(
    id: string,
    file: File
  ): Promise<SimuladoDetalheDto> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<SimuladoDetalheDto>(`/simulados/${id}/pdf`, formData);
  },

  async getSimuladoPdfUrl(
    id: string,
    signal?: AbortSignal
  ): Promise<SimuladoPdfSignedUrlDto> {
    return apiClient.get<SimuladoPdfSignedUrlDto>(`/simulados/${id}/pdf-url`, {
      signal,
    });
  },

  async deleteSimuladoPdf(id: string): Promise<SimuladoDetalheDto> {
    return apiClient.delete<SimuladoDetalheDto>(`/simulados/${id}/pdf`);
  },

  async createQuestao(
    simuladoId: string,
    input: CreateSimuladoQuestaoInput
  ): Promise<SimuladoQuestaoDto> {
    return apiClient.post<SimuladoQuestaoDto>(
      `/simulados/${simuladoId}/questoes`,
      input
    );
  },

  async updateQuestao(
    simuladoId: string,
    questaoId: string,
    input: UpdateSimuladoQuestaoInput
  ): Promise<SimuladoQuestaoDto> {
    return apiClient.patch<SimuladoQuestaoDto>(
      `/simulados/${simuladoId}/questoes/${questaoId}`,
      input
    );
  },

  async deleteQuestao(
    simuladoId: string,
    questaoId: string
  ): Promise<{ id: string }> {
    return apiClient.delete<{ id: string }>(
      `/simulados/${simuladoId}/questoes/${questaoId}`
    );
  },

  async classificarQuestao(
    simuladoId: string,
    questaoId: string,
    input: ClassificarQuestaoSimuladoInput
  ): Promise<SimuladoQuestaoDto> {
    return apiClient.post<SimuladoQuestaoDto>(
      `/simulados/${simuladoId}/questoes/${questaoId}/classificar`,
      input
    );
  },

  async createPensamento(
    simuladoId: string,
    input: CreateSimuladoPensamentoInput
  ): Promise<SimuladoPensamentoDto> {
    return apiClient.post<SimuladoPensamentoDto>(
      `/simulados/${simuladoId}/pensamentos`,
      input
    );
  },

  async updatePensamento(
    simuladoId: string,
    pensamentoId: string,
    input: UpdateSimuladoPensamentoInput
  ): Promise<SimuladoPensamentoDto> {
    return apiClient.patch<SimuladoPensamentoDto>(
      `/simulados/${simuladoId}/pensamentos/${pensamentoId}`,
      input
    );
  },

  async deletePensamento(
    simuladoId: string,
    pensamentoId: string
  ): Promise<{ id: string }> {
    return apiClient.delete<{ id: string }>(
      `/simulados/${simuladoId}/pensamentos/${pensamentoId}`
    );
  },

  async exportSimuladoIa(
    simuladoId: string,
    signal?: AbortSignal
  ): Promise<SimuladoExportIaDto> {
    return apiClient.get<SimuladoExportIaDto>(
      `/simulados/${simuladoId}/export-ia`,
      { signal }
    );
  },
};
