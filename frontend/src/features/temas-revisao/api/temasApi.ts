import type {
  CreateReflexaoInput,
  CreateTemaInput,
  RegistrarPraticaInput,
  TemasQuery,
  UpdateReflexaoInput,
  UpdateTemaInput,
} from '@shared/schemas/temas.schema';
import type { PaginationMeta } from '@shared/types/api.types';
import type {
  ReflexaoDto,
  TemaDetalheDto,
  TemaDto,
  TemaListItemDto,
} from '@shared/types/temas.types';
import { apiClient } from '@/lib/apiClient';

export type TemasListQueryParams = Partial<TemasQuery>;

export interface ListTemasResponse {
  items: TemaListItemDto[];
  pagination: PaginationMeta;
}

export const temasApi = {
  async listTemas(
    query: TemasListQueryParams = {},
    signal?: AbortSignal
  ): Promise<ListTemasResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const response = await apiClient.getPaginated<TemaListItemDto[]>('/temas', {
      query: {
        page,
        limit,
        search: query.search?.trim() || undefined,
        sortBy: query.sortBy ?? 'oldest_review',
        reviewMode: query.reviewMode,
      },
      signal,
    });

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

  async getTemaById(
    id: string,
    signal?: AbortSignal
  ): Promise<TemaDetalheDto> {
    return apiClient.get<TemaDetalheDto>(`/temas/${id}`, { signal });
  },

  async createTema(input: CreateTemaInput): Promise<TemaListItemDto> {
    return apiClient.post<TemaListItemDto>('/temas', input);
  },

  async updateTema(id: string, input: UpdateTemaInput): Promise<TemaDto> {
    return apiClient.patch<TemaDto>(`/temas/${id}`, input);
  },

  async deleteTema(id: string): Promise<{ id: string }> {
    return apiClient.delete<{ id: string }>(`/temas/${id}`);
  },

  async registrarPratica(input: RegistrarPraticaInput): Promise<TemaDto[]> {
    return apiClient.post<TemaDto[]>('/temas/pratica', input);
  },

  async createReflexao(input: CreateReflexaoInput): Promise<ReflexaoDto> {
    return apiClient.post<ReflexaoDto>('/reflexoes', input);
  },

  async updateReflexao(
    id: string,
    input: UpdateReflexaoInput
  ): Promise<ReflexaoDto> {
    return apiClient.patch<ReflexaoDto>(`/reflexoes/${id}`, input);
  },

  async deleteReflexao(id: string): Promise<{ id: string }> {
    return apiClient.delete<{ id: string }>(`/reflexoes/${id}`);
  },
};
