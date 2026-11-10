import type {
  CreateReflexaoInput,
  CreateTemaInput,
  RegistrarPraticaInput,
  UpdateReflexaoInput,
  UpdateTemaInput,
} from '@shared/schemas/temas.schema';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  temasApi,
  type TemasListQueryParams,
} from '@/features/temas-revisao/api/temasApi';
import { getErrorMessage } from '@/lib/errorMessages';

export const temasKeys = {
  all: ['temas'] as const,
  lists: () => [...temasKeys.all, 'list'] as const,
  list: (filters: TemasListQueryParams) =>
    [...temasKeys.lists(), filters] as const,
  options: (search: string) =>
    [...temasKeys.all, 'options', search] as const,
  details: () => [...temasKeys.all, 'detail'] as const,
  detail: (id: string) => [...temasKeys.details(), id] as const,
};

export function useTemasListQuery(filters: TemasListQueryParams) {
  return useQuery({
    queryKey: temasKeys.list(filters),
    queryFn: ({ signal }) => temasApi.listTemas(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useTemaDetailQuery(id: string, enabled: boolean) {
  return useQuery({
    queryKey: temasKeys.detail(id),
    queryFn: ({ signal }) => temasApi.getTemaById(id, signal),
    enabled,
  });
}

export function useTemasOptionsQuery(search: string, enabled = true) {
  const normalizedSearch = search.trim();

  return useQuery({
    queryKey: temasKeys.options(normalizedSearch),
    queryFn: ({ signal }) =>
      temasApi.listTemas(
        {
          page: 1,
          limit: 100,
          sortBy: 'name_asc',
          search: normalizedSearch || undefined,
        },
        signal
      ),
    enabled,
  });
}

export function useCreateTemaMutation(options?: { successMessage?: string }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTemaInput) => temasApi.createTema(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: temasKeys.all });
      toast.success(options?.successMessage ?? 'Tema criado com sucesso.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateTemaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTemaInput }) =>
      temasApi.updateTema(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: temasKeys.all });
      toast.success('Tema atualizado com sucesso.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteTemaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => temasApi.deleteTema(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: temasKeys.all });
      toast.success('Tema excluído com sucesso.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useRegistrarPraticaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RegistrarPraticaInput) =>
      temasApi.registrarPratica(input),
    onSuccess: async (updatedTemas) => {
      await queryClient.invalidateQueries({ queryKey: temasKeys.all });
      const label =
        updatedTemas.length === 1
          ? 'Prática registrada para 1 tema.'
          : `Prática registrada para ${updatedTemas.length} temas.`;
      toast.success(label);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useCreateReflexaoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateReflexaoInput) => temasApi.createReflexao(input),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: temasKeys.all });
      toast.success(
        created.temasConectados.length > 0
          ? 'Conexão entre temas registrada com sucesso.'
          : 'Reflexão registrada com sucesso.'
      );
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateReflexaoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReflexaoInput }) =>
      temasApi.updateReflexao(id, input),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: temasKeys.all });
      toast.success(
        updated.temasConectados.length > 0
          ? 'Conexão atualizada com sucesso.'
          : 'Reflexão atualizada com sucesso.'
      );
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteReflexaoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => temasApi.deleteReflexao(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: temasKeys.all });
      toast.success('Registro excluído com sucesso.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
