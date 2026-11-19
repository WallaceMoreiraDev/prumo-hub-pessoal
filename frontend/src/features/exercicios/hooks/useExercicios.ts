import type {
  CreateExercicioAvulsoInput,
  EstudosResumoQuery,
  ListExerciciosQuery,
  UpdateExercicioAvulsoInput,
} from '@shared/schemas/exercicios.schema';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { cadernoErrosKeys } from '@/features/caderno-erros/hooks/useCadernoErros';
import { exerciciosApi } from '@/features/exercicios/api/exerciciosApi';
import { temasKeys } from '@/features/temas-revisao/hooks/useTemas';
import { getErrorMessage } from '@/lib/errorMessages';

export const exerciciosKeys = {
  all: ['exercicios'] as const,
  lists: () => [...exerciciosKeys.all, 'list'] as const,
  list: (query?: ListExerciciosQuery) =>
    [...exerciciosKeys.lists(), query] as const,
  details: () => [...exerciciosKeys.all, 'detail'] as const,
  detail: (id: string) => [...exerciciosKeys.details(), id] as const,
  resumo: (query: EstudosResumoQuery) =>
    ['estudos-resumo', query] as const,
  exportIa: (query: EstudosResumoQuery) =>
    ['estudos-export-ia', query] as const,
};

export function useExerciciosListQuery(
  query?: ListExerciciosQuery,
  enabled = true
) {
  return useQuery({
    queryKey: exerciciosKeys.list(query),
    queryFn: ({ signal }) => exerciciosApi.list(query, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useExercicioDetalheQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: exerciciosKeys.detail(id),
    queryFn: ({ signal }) => exerciciosApi.getById(id, signal),
    enabled: Boolean(id) && enabled,
  });
}

export function useEstudosResumoQuery(
  query: EstudosResumoQuery,
  enabled = true
) {
  return useQuery({
    queryKey: exerciciosKeys.resumo(query),
    queryFn: ({ signal }) => exerciciosApi.getResumo(query, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useEstudoExportIaQuery(
  query: EstudosResumoQuery,
  enabled = true
) {
  return useQuery({
    queryKey: exerciciosKeys.exportIa(query),
    queryFn: ({ signal }) => exerciciosApi.getExportIa(query, signal),
    enabled,
  });
}

export function useCreateExercicioMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateExercicioAvulsoInput) =>
      exerciciosApi.create(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: exerciciosKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['estudos-resumo'] }),
        queryClient.invalidateQueries({ queryKey: temasKeys.all }),
        queryClient.invalidateQueries({ queryKey: cadernoErrosKeys.all }),
      ]);
      toast.success('Exercício registrado com sucesso.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateExercicioMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateExercicioAvulsoInput;
    }) => exerciciosApi.update(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: exerciciosKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['estudos-resumo'] }),
        queryClient.invalidateQueries({ queryKey: temasKeys.all }),
      ]);
      toast.success('Exercício atualizado com sucesso.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteExercicioMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => exerciciosApi.delete(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: exerciciosKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['estudos-resumo'] }),
      ]);
      toast.success('Exercício excluído com sucesso.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
