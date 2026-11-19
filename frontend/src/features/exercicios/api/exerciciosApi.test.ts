import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateExercicioAvulsoInput } from '@shared/schemas/exercicios.schema';
import { exerciciosApi } from '@/features/exercicios/api/exerciciosApi';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  getPaginated: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/lib/apiClient', () => ({
  apiClient: mockApiClient,
}));

describe('exerciciosApi', () => {
  const EXERCICIO_ID = '770e8400-e29b-41d4-a716-446655440010';
  const TEMA_ID = '550e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.get.mockResolvedValue({});
    mockApiClient.getPaginated.mockResolvedValue({
      data: [],
      meta: {
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      },
    });
    mockApiClient.post.mockResolvedValue({});
    mockApiClient.patch.mockResolvedValue({});
    mockApiClient.delete.mockResolvedValue({ id: EXERCICIO_ID });
  });

  it('usa caminhos relativos sem duplicar /api/v1 em todos os endpoints', async () => {
    const createPayload: CreateExercicioAvulsoInput = {
      titulo: 'Exercício 1',
      temaIds: [TEMA_ID],
      duracaoSegundos: 120,
      enunciado: null,
      linkExterno: null,
      observacao: null,
      desfecho: null,
      lousaId: null,
    };
    const updatePayload = {
      titulo: 'Exercício Atualizado',
      enunciado: null,
      linkExterno: null,
      observacao: null,
    };
    const controller = new AbortController();

    await exerciciosApi.create(createPayload);
    await exerciciosApi.list({ page: 2, limit: 10, search: 'dfs', temaId: TEMA_ID }, controller.signal);
    await exerciciosApi.getById(EXERCICIO_ID, controller.signal);
    await exerciciosApi.update(EXERCICIO_ID, updatePayload);
    await exerciciosApi.delete(EXERCICIO_ID);
    await exerciciosApi.getResumo({ periodo: 'dia', data: '2026-11-18' }, controller.signal);
    await exerciciosApi.getExportIa({ periodo: 'semana', data: '2026-11-18' }, controller.signal);

    expect(mockApiClient.post).toHaveBeenCalledWith('/exercicios', createPayload);
    expect(mockApiClient.getPaginated).toHaveBeenCalledWith('/exercicios', {
      query: {
        page: 2,
        limit: 10,
        search: 'dfs',
        temaId: TEMA_ID,
        desfecho: undefined,
      },
      signal: controller.signal,
    });
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      1,
      `/exercicios/${EXERCICIO_ID}`,
      { signal: controller.signal }
    );
    expect(mockApiClient.patch).toHaveBeenCalledWith(
      `/exercicios/${EXERCICIO_ID}`,
      updatePayload
    );
    expect(mockApiClient.delete).toHaveBeenCalledWith(`/exercicios/${EXERCICIO_ID}`);
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      2,
      '/exercicios/resumo',
      {
        query: {
          periodo: 'dia',
          data: '2026-11-18',
          dataInicio: undefined,
          dataFim: undefined,
        },
        signal: controller.signal,
      }
    );
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      3,
      '/exercicios/export-ia',
      {
        query: {
          periodo: 'semana',
          data: '2026-11-18',
          dataInicio: undefined,
          dataFim: undefined,
        },
        signal: controller.signal,
      }
    );

    const allCalledPaths = [
      ...mockApiClient.post.mock.calls.map((c) => c[0]),
      ...mockApiClient.getPaginated.mock.calls.map((c) => c[0]),
      ...mockApiClient.get.mock.calls.map((c) => c[0]),
      ...mockApiClient.patch.mock.calls.map((c) => c[0]),
      ...mockApiClient.delete.mock.calls.map((c) => c[0]),
    ];

    for (const path of allCalledPaths) {
      expect(typeof path).toBe('string');
      expect(path).not.toContain('/api/v1');
    }
  });

  it('aplica defaults corretos para paginação e busca ao listar', async () => {
    await exerciciosApi.list();

    expect(mockApiClient.getPaginated).toHaveBeenCalledWith('/exercicios', {
      query: {
        page: 1,
        limit: 20,
        search: undefined,
        temaId: undefined,
        desfecho: undefined,
      },
      signal: undefined,
    });
  });
});
