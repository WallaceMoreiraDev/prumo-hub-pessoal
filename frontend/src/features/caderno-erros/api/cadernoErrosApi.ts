import type {
  CadernoErrosQuery,
  CreateManualErrorInput,
  RevisarCadernoErroInput,
  UpdateCadernoErroInput,
} from '@shared/schemas/caderno-erros.schema';
import type { PaginationMeta } from '@shared/types/api.types';
import type { CadernoErroDto } from '@shared/types/caderno-erros.types';
import { apiClient } from '@/lib/apiClient';

export type CadernoErrosListQueryParams = Partial<CadernoErrosQuery>;

export interface ListCadernoErrosResponse {
  items: CadernoErroDto[];
  pagination: PaginationMeta;
}

export const cadernoErrosApi = {
  async listErros(
    query: CadernoErrosListQueryParams = {},
    signal?: AbortSignal
  ): Promise<ListCadernoErrosResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const response = await apiClient.getPaginated<CadernoErroDto[]>(
      '/caderno-erros',
      {
        query: {
          page,
          limit,
          status: query.status,
          temaId: query.temaId,
          origem: query.origem,
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

  async getErroById(
    id: string,
    signal?: AbortSignal
  ): Promise<CadernoErroDto> {
    return apiClient.get<CadernoErroDto>(`/caderno-erros/${id}`, { signal });
  },

  async createManualErro(
    input: CreateManualErrorInput
  ): Promise<CadernoErroDto> {
    return apiClient.post<CadernoErroDto>('/caderno-erros', input);
  },

  async updateErro(
    id: string,
    input: Partial<UpdateCadernoErroInput>
  ): Promise<CadernoErroDto> {
    return apiClient.patch<CadernoErroDto>(`/caderno-erros/${id}`, input);
  },

  async revisarErro(
    id: string,
    input: RevisarCadernoErroInput
  ): Promise<CadernoErroDto> {
    return apiClient.post<CadernoErroDto>(`/caderno-erros/${id}/revisar`, input);
  },

  async devolverErro(id: string): Promise<CadernoErroDto> {
    return apiClient.post<CadernoErroDto>(`/caderno-erros/${id}/devolver`);
  },

  async deleteErro(id: string): Promise<{ id: string }> {
    return apiClient.delete<{ id: string }>(`/caderno-erros/${id}`);
  },
};
