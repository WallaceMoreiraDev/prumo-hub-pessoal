import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  lousasApi,
  type SaveLousaPayload,
} from '@/features/lousas/api/lousasApi';
import { getErrorMessage } from '@/lib/errorMessages';

export const lousasKeys = {
  all: ['lousas'] as const,
  details: () => [...lousasKeys.all, 'detail'] as const,
  detail: (id: string) => [...lousasKeys.details(), id] as const,
  urls: (id: string) => [...lousasKeys.all, 'urls', id] as const,
};

const TEMAS_QUERY_KEY = ['temas'] as const;
const CADERNO_ERROS_QUERY_KEY = ['caderno-erros'] as const;

export function useLousaDetailQuery(
  id: string | null | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: lousasKeys.detail(id ?? 'none'),
    queryFn: ({ signal }) => lousasApi.getLousaById(id as string, signal),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateLousaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveLousaPayload) => lousasApi.createLousa(payload),
    onSuccess: async (saved) => {
      queryClient.setQueryData(lousasKeys.detail(saved.id), saved);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: lousasKeys.all }),
        queryClient.invalidateQueries({ queryKey: TEMAS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CADERNO_ERROS_QUERY_KEY }),
      ]);
      toast.success('Lousa salva com sucesso.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateLousaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: SaveLousaPayload;
    }) => lousasApi.updateLousa(id, payload),
    onSuccess: async (saved) => {
      queryClient.setQueryData(lousasKeys.detail(saved.id), saved);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: lousasKeys.detail(saved.id) }),
        queryClient.invalidateQueries({ queryKey: lousasKeys.urls(saved.id) }),
        queryClient.invalidateQueries({ queryKey: TEMAS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CADERNO_ERROS_QUERY_KEY }),
      ]);
      toast.success('Lousa atualizada com sucesso.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteLousaMutation(options?: { silent?: boolean }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => lousasApi.deleteLousa(id),
    onSuccess: async (_result, deletedId) => {
      queryClient.removeQueries({ queryKey: lousasKeys.detail(deletedId) });
      queryClient.removeQueries({ queryKey: lousasKeys.urls(deletedId) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: TEMAS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CADERNO_ERROS_QUERY_KEY }),
      ]);
      if (!options?.silent) {
        toast.success('Lousa excluída com sucesso.');
      }
    },
    onError: (error) => {
      if (!options?.silent) {
        toast.error(getErrorMessage(error));
      }
    },
  });
}
