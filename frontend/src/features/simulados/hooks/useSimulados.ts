import type {
  ClassificarQuestaoSimuladoInput,
  CreateSimuladoInput,
  CreateSimuladoPensamentoInput,
  CreateSimuladoQuestaoInput,
  FinalizarSimuladoInput,
  UpdateSimuladoInput,
  UpdateSimuladoPensamentoInput,
  UpdateSimuladoQuestaoInput,
} from '@shared/schemas/simulados.schema';
import type { SimuladoDetalheDto } from '@shared/types/simulados.types';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { cadernoErrosKeys } from '@/features/caderno-erros/hooks/useCadernoErros';
import {
  simuladosApi,
  type SimuladosListQueryParams,
} from '@/features/simulados/api/simuladosApi';
import {
  clearSimuladoTimerMirror,
  removePensamentoFromSimuladoDetalhe,
  saveSimuladoTimerMirror,
  upsertPensamentoInSimuladoDetalhe,
  upsertQuestaoInSimuladoDetalhe,
} from '@/features/simulados/utils/simulados';
import { temasKeys } from '@/features/temas-revisao/hooks/useTemas';
import { getErrorMessage } from '@/lib/errorMessages';

export const simuladosKeys = {
  all: ['simulados'] as const,
  lists: () => [...simuladosKeys.all, 'list'] as const,
  list: (filters: SimuladosListQueryParams) =>
    [...simuladosKeys.lists(), filters] as const,
  details: () => [...simuladosKeys.all, 'detail'] as const,
  detail: (id: string) => [...simuladosKeys.details(), id] as const,
  exportIa: (id: string) =>
    [...simuladosKeys.detail(id), 'export-ia'] as const,
};

export function useSimuladosListQuery(filters: SimuladosListQueryParams) {
  return useQuery({
    queryKey: simuladosKeys.list(filters),
    queryFn: ({ signal }) => simuladosApi.listSimulados(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSimuladoDetailQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: simuladosKeys.detail(id),
    queryFn: ({ signal }) => simuladosApi.getSimuladoById(id, signal),
    enabled,
    refetchOnWindowFocus: false,
  });
}

export function useSimuladoExportIaQuery(id: string, enabled: boolean) {
  return useQuery({
    queryKey: simuladosKeys.exportIa(id),
    queryFn: ({ signal }) => simuladosApi.exportSimuladoIa(id, signal),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useCreateSimuladoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSimuladoInput) => simuladosApi.createSimulado(input),
    onSuccess: async (created) => {
      queryClient.setQueryData(simuladosKeys.detail(created.id), created);
      await queryClient.invalidateQueries({ queryKey: simuladosKeys.lists() });
      toast.success('Simulado criado. Agora anexe o PDF e cadastre as questões.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateSimuladoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSimuladoInput }) =>
      simuladosApi.updateSimulado(id, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(simuladosKeys.detail(updated.id), updated);
      await queryClient.invalidateQueries({ queryKey: simuladosKeys.lists() });
      toast.success('Dados do simulado atualizados.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteSimuladoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => simuladosApi.deleteSimulado(id),
    onSuccess: async (_result, deletedId) => {
      clearSimuladoTimerMirror(deletedId);
      await queryClient.cancelQueries({
        queryKey: simuladosKeys.detail(deletedId),
      });
      queryClient.removeQueries({
        queryKey: simuladosKeys.detail(deletedId),
        type: 'inactive',
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: simuladosKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: cadernoErrosKeys.all }),
        queryClient.invalidateQueries({ queryKey: temasKeys.all }),
      ]);
      toast.success('Simulado excluído com sucesso.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useIniciarSimuladoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => simuladosApi.iniciarSimulado(id),
    onSuccess: async (started) => {
      if (started.startedAt) {
        saveSimuladoTimerMirror({
          simuladoId: started.id,
          startedAt: started.startedAt,
          duracaoConfiguradaSegundos: started.duracaoConfiguradaSegundos,
          updatedAt: new Date().toISOString(),
        });
      }
      queryClient.setQueryData(simuladosKeys.detail(started.id), started);
      await queryClient.invalidateQueries({ queryKey: simuladosKeys.lists() });
      toast.success('Simulado iniciado. Cronômetro em andamento.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useFinalizarSimuladoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: FinalizarSimuladoInput;
    }) => simuladosApi.finalizarSimulado(id, input),
    onSuccess: async (finished) => {
      clearSimuladoTimerMirror(finished.id);
      queryClient.setQueryData(simuladosKeys.detail(finished.id), finished);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: simuladosKeys.lists() }),
        queryClient.invalidateQueries({
          queryKey: simuladosKeys.detail(finished.id),
        }),
      ]);
      toast.success('Simulado finalizado. Você já pode classificar as questões.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUploadSimuladoPdfMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      simuladosApi.uploadSimuladoPdf(id, file),
    onSuccess: async (updated) => {
      queryClient.setQueryData(simuladosKeys.detail(updated.id), updated);
      await queryClient.invalidateQueries({ queryKey: simuladosKeys.lists() });
      toast.success('PDF anexado ao simulado.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteSimuladoPdfMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => simuladosApi.deleteSimuladoPdf(id),
    onSuccess: async (updated) => {
      queryClient.setQueryData(simuladosKeys.detail(updated.id), updated);
      await queryClient.invalidateQueries({ queryKey: simuladosKeys.lists() });
      toast.success('PDF removido do simulado.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useRefreshSimuladoPdfUrlMutation() {
  return useMutation({
    mutationFn: (id: string) => simuladosApi.getSimuladoPdfUrl(id),
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useCreateQuestaoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      simuladoId,
      input,
    }: {
      simuladoId: string;
      input: CreateSimuladoQuestaoInput;
    }) => simuladosApi.createQuestao(simuladoId, input),
    onSuccess: async (_created, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: simuladosKeys.detail(variables.simuladoId),
        }),
        queryClient.invalidateQueries({ queryKey: simuladosKeys.lists() }),
      ]);
      toast.success('Questão adicionada ao simulado.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateQuestaoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      simuladoId,
      questaoId,
      input,
    }: {
      simuladoId: string;
      questaoId: string;
      input: UpdateSimuladoQuestaoInput;
    }) => simuladosApi.updateQuestao(simuladoId, questaoId, input),
    onSuccess: async (_updated, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: simuladosKeys.detail(variables.simuladoId),
        }),
        queryClient.invalidateQueries({ queryKey: simuladosKeys.lists() }),
      ]);
      toast.success('Questão atualizada.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteQuestaoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      simuladoId,
      questaoId,
    }: {
      simuladoId: string;
      questaoId: string;
    }) => simuladosApi.deleteQuestao(simuladoId, questaoId),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: simuladosKeys.detail(variables.simuladoId),
        }),
        queryClient.invalidateQueries({ queryKey: simuladosKeys.lists() }),
      ]);
      toast.success('Questão removida do simulado.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useClassificarQuestaoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      simuladoId,
      questaoId,
      input,
    }: {
      simuladoId: string;
      questaoId: string;
      input: ClassificarQuestaoSimuladoInput;
    }) => simuladosApi.classificarQuestao(simuladoId, questaoId, input),
    onSuccess: async (updatedQuestao, variables) => {
      queryClient.setQueryData<SimuladoDetalheDto>(
        simuladosKeys.detail(variables.simuladoId),
        (prev) =>
          prev ? upsertQuestaoInSimuladoDetalhe(prev, updatedQuestao) : prev
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: simuladosKeys.all }),
        queryClient.invalidateQueries({ queryKey: cadernoErrosKeys.all }),
        queryClient.invalidateQueries({ queryKey: temasKeys.all }),
      ]);

      if (variables.input.resultado === 'ACERTEI') {
        toast.success(
          updatedQuestao.temas.length > 0
            ? 'Questão marcada como Acertei e revisão dos temas atualizada.'
            : 'Questão marcada como Acertei.'
        );
      } else {
        toast.success(
          'Classificação salva e questão sincronizada no Caderno de Erros.'
        );
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useCreatePensamentoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      simuladoId,
      input,
    }: {
      simuladoId: string;
      input: CreateSimuladoPensamentoInput;
    }) => simuladosApi.createPensamento(simuladoId, input),
    onSuccess: async (created, variables) => {
      // CRÍTICO: Atualiza apenas cache local do detalhe sem invalidar detail(id),
      // evitando refetch de GET /simulados/:id e renovação da pdfSignedUrl no meio da prova.
      queryClient.setQueryData<SimuladoDetalheDto>(
        simuladosKeys.detail(variables.simuladoId),
        (prev) =>
          prev ? upsertPensamentoInSimuladoDetalhe(prev, created) : prev
      );
      await queryClient.invalidateQueries({ queryKey: simuladosKeys.lists() });
      toast.success('Pensamento registrado.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdatePensamentoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      simuladoId,
      pensamentoId,
      input,
    }: {
      simuladoId: string;
      pensamentoId: string;
      input: UpdateSimuladoPensamentoInput;
    }) => simuladosApi.updatePensamento(simuladoId, pensamentoId, input),
    onSuccess: async (updated, variables) => {
      queryClient.setQueryData<SimuladoDetalheDto>(
        simuladosKeys.detail(variables.simuladoId),
        (prev) =>
          prev ? upsertPensamentoInSimuladoDetalhe(prev, updated) : prev
      );
      await queryClient.invalidateQueries({ queryKey: simuladosKeys.lists() });
      toast.success('Pensamento atualizado.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeletePensamentoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      simuladoId,
      pensamentoId,
    }: {
      simuladoId: string;
      pensamentoId: string;
    }) => simuladosApi.deletePensamento(simuladoId, pensamentoId),
    onSuccess: async (_result, variables) => {
      queryClient.setQueryData<SimuladoDetalheDto>(
        simuladosKeys.detail(variables.simuladoId),
        (prev) =>
          prev
            ? removePensamentoFromSimuladoDetalhe(prev, variables.pensamentoId)
            : prev
      );
      await queryClient.invalidateQueries({ queryKey: simuladosKeys.lists() });
      toast.success('Pensamento excluído.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
