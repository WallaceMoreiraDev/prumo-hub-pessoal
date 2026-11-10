import type {
  CreateManualErrorInput,
  RevisarCadernoErroInput,
  UpdateCadernoErroInput,
} from '@shared/schemas/caderno-erros.schema';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  cadernoErrosApi,
  type CadernoErrosListQueryParams,
} from '@/features/caderno-erros/api/cadernoErrosApi';
import { temasKeys } from '@/features/temas-revisao/hooks/useTemas';
import { getErrorMessage } from '@/lib/errorMessages';

export const cadernoErrosKeys = {
  all: ['caderno-erros'] as const,
  lists: () => [...cadernoErrosKeys.all, 'list'] as const,
  list: (filters: CadernoErrosListQueryParams) =>
    [...cadernoErrosKeys.lists(), filters] as const,
  details: () => [...cadernoErrosKeys.all, 'detail'] as const,
  detail: (id: string) => [...cadernoErrosKeys.details(), id] as const,
};

export function useCadernoErrosListQuery(filters: CadernoErrosListQueryParams) {
  return useQuery({
    queryKey: cadernoErrosKeys.list(filters),
    queryFn: ({ signal }) => cadernoErrosApi.listErros(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useCadernoErroDetailQuery(id: string, enabled: boolean) {
  return useQuery({
    queryKey: cadernoErrosKeys.detail(id),
    queryFn: ({ signal }) => cadernoErrosApi.getErroById(id, signal),
    enabled,
  });
}

export function useCreateCadernoErroMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateManualErrorInput) =>
      cadernoErrosApi.createManualErro(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cadernoErrosKeys.all }),
        queryClient.invalidateQueries({ queryKey: temasKeys.all }),
      ]);
      toast.success('Erro registrado no Caderno de Erros.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateCadernoErroMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<UpdateCadernoErroInput>;
    }) => cadernoErrosApi.updateErro(id, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cadernoErrosKeys.all }),
        queryClient.invalidateQueries({ queryKey: temasKeys.all }),
      ]);
      toast.success('Registro atualizado com sucesso.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useRevisarCadernoErroMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: RevisarCadernoErroInput;
    }) => cadernoErrosApi.revisarErro(id, input),
    onSuccess: async (_updated, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cadernoErrosKeys.all }),
        queryClient.invalidateQueries({ queryKey: temasKeys.all }),
      ]);
      toast.success(
        variables.input.reviewMode === 'SOLO'
          ? 'Erro concluído sozinho e revisão dos temas atualizada.'
          : 'Erro revisado com ajuda e revisão dos temas atualizada.'
      );
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDevolverCadernoErroMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cadernoErrosApi.devolverErro(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cadernoErrosKeys.all }),
        queryClient.invalidateQueries({ queryKey: temasKeys.all }),
      ]);
      toast.success('Erro devolvido para a aba Pendentes.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteCadernoErroMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cadernoErrosApi.deleteErro(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cadernoErrosKeys.all }),
        queryClient.invalidateQueries({ queryKey: temasKeys.all }),
      ]);
      toast.success('Registro excluído do Caderno de Erros.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
