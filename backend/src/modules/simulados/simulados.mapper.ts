import type { Tables } from '@shared/types/database.types';
import type {
  SimuladoDetalheDto,
  SimuladoDto,
  SimuladoListItemDto,
  SimuladoPensamentoDto,
  SimuladoQuestaoDto,
} from '@shared/types/simulados.types';
import type { TemaSummaryDto } from '@shared/types/temas.types';
import {
  compareTemaByNome,
  mapTemaSummaryDto,
  type TemaSummaryRow,
  unwrapSingleRelation,
} from '../temas/temas.mapper';

export type SimuladoRow = Tables<'simulados'>;
export type SimuladoQuestaoRow = Tables<'simulado_questoes'>;
export type SimuladoPensamentoRow = Tables<'simulado_pensamentos'>;

export interface SimuladoQuestaoTemaJoinRow {
  tema: TemaSummaryRow | TemaSummaryRow[] | null;
}

export interface SimuladoQuestaoWithRelationsRow extends SimuladoQuestaoRow {
  simulado_questao_temas: SimuladoQuestaoTemaJoinRow[] | null;
  simulado_pensamentos: SimuladoPensamentoRow[] | null;
}

export interface SimuladoWithRelationsRow extends SimuladoRow {
  simulado_questoes: SimuladoQuestaoWithRelationsRow[] | null;
}

export interface SimuladoListMetrics {
  totalQuestoes: number;
  totalQuestoesClassificadas: number;
  totalAcertos: number;
  totalParciais: number;
  totalErros: number;
  totalPensamentos: number;
}

export function mapSimuladoPensamentoDto(
  row: SimuladoPensamentoRow
): SimuladoPensamentoDto {
  return {
    id: row.id,
    userId: row.user_id,
    simuladoQuestaoId: row.simulado_questao_id,
    descricao: row.descricao,
    tempoDecorridoSegundos: row.tempo_decorrido_segundos,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function comparePensamentosCronologico(
  a: SimuladoPensamentoDto,
  b: SimuladoPensamentoDto
): number {
  const timeA = Date.parse(a.createdAt);
  const timeB = Date.parse(b.createdAt);

  if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
    return timeA - timeB;
  }

  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1;
  }

  if (a.tempoDecorridoSegundos !== b.tempoDecorridoSegundos) {
    if (a.tempoDecorridoSegundos === null) {
      return 1;
    }
    if (b.tempoDecorridoSegundos === null) {
      return -1;
    }
    return a.tempoDecorridoSegundos - b.tempoDecorridoSegundos;
  }

  return a.id.localeCompare(b.id);
}

export function compareQuestoesByOrdem(
  a: SimuladoQuestaoDto,
  b: SimuladoQuestaoDto
): number {
  if (a.ordem !== b.ordem) {
    return a.ordem - b.ordem;
  }

  const timeA = Date.parse(a.createdAt);
  const timeB = Date.parse(b.createdAt);

  if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
    return timeA - timeB;
  }

  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1;
  }

  return a.id.localeCompare(b.id);
}

export function mapSimuladoQuestaoDto(
  row: SimuladoQuestaoWithRelationsRow
): SimuladoQuestaoDto {
  const temasMap = new Map<string, TemaSummaryDto>();
  for (const joinRow of row.simulado_questao_temas ?? []) {
    const temaRow = unwrapSingleRelation(joinRow.tema);
    if (temaRow) {
      temasMap.set(temaRow.id, mapTemaSummaryDto(temaRow));
    }
  }
  const temas = Array.from(temasMap.values()).sort(compareTemaByNome);

  const pensamentosMap = new Map<string, SimuladoPensamentoDto>();
  for (const pensamentoRow of row.simulado_pensamentos ?? []) {
    pensamentosMap.set(
      pensamentoRow.id,
      mapSimuladoPensamentoDto(pensamentoRow)
    );
  }
  const pensamentos = Array.from(pensamentosMap.values()).sort(
    comparePensamentosCronologico
  );

  return {
    id: row.id,
    userId: row.user_id,
    simuladoId: row.simulado_id,
    numeroQuestao: row.numero_questao,
    tituloQuestao: row.titulo_questao,
    ordem: row.ordem,
    resultado: row.resultado,
    observacaoPosRevisao: row.observacao_pos_revisao,
    temas,
    pensamentos,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSimuladoDto(row: SimuladoRow): SimuladoDto {
  return {
    id: row.id,
    userId: row.user_id,
    titulo: row.titulo,
    duracaoConfiguradaSegundos: row.duracao_configurada_segundos,
    tempoGastoSegundos: row.tempo_gasto_segundos,
    pdfStoragePath: row.pdf_storage_path,
    hasPdf: row.pdf_storage_path !== null,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSimuladoListItemDto(
  row: SimuladoRow,
  metrics?: SimuladoListMetrics
): SimuladoListItemDto {
  return {
    ...mapSimuladoDto(row),
    totalQuestoes: metrics?.totalQuestoes ?? 0,
    totalQuestoesClassificadas: metrics?.totalQuestoesClassificadas ?? 0,
    totalAcertos: metrics?.totalAcertos ?? 0,
    totalParciais: metrics?.totalParciais ?? 0,
    totalErros: metrics?.totalErros ?? 0,
    totalPensamentos: metrics?.totalPensamentos ?? 0,
  };
}

export function mapSimuladoDetalheDto(
  row: SimuladoWithRelationsRow,
  pdfSignedUrl: string | null
): SimuladoDetalheDto {
  const questoesMap = new Map<string, SimuladoQuestaoDto>();
  for (const questaoRow of row.simulado_questoes ?? []) {
    questoesMap.set(questaoRow.id, mapSimuladoQuestaoDto(questaoRow));
  }

  const questoes = Array.from(questoesMap.values()).sort(
    compareQuestoesByOrdem
  );

  return {
    ...mapSimuladoDto(row),
    pdfSignedUrl,
    questoes,
  };
}
