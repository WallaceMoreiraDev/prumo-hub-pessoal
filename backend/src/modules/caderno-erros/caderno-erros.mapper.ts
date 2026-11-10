import type {
  CadernoErroDto,
  CadernoErroSimuladoMetaDto,
} from '@shared/types/caderno-erros.types';
import type { Tables } from '@shared/types/database.types';
import type { SimuladoPensamentoDto } from '@shared/types/simulados.types';
import type { TemaSummaryDto } from '@shared/types/temas.types';
import {
  compareTemaByNome,
  mapTemaSummaryDto,
  type TemaSummaryRow,
  unwrapSingleRelation,
} from '../temas/temas.mapper';

export type CadernoErroRow = Tables<'caderno_erros'>;
export type SimuladoQuestaoRow = Tables<'simulado_questoes'>;
export type SimuladoRow = Tables<'simulados'>;
export type SimuladoPensamentoRow = Tables<'simulado_pensamentos'>;

export interface CadernoErroTemaJoinRow {
  tema: TemaSummaryRow | TemaSummaryRow[] | null;
}

export type SimuladoSummaryJoinRow = Pick<SimuladoRow, 'id' | 'titulo'>;

export type SimuladoPensamentoJoinRow = Pick<
  SimuladoPensamentoRow,
  | 'id'
  | 'user_id'
  | 'simulado_questao_id'
  | 'descricao'
  | 'tempo_decorrido_segundos'
  | 'created_at'
  | 'updated_at'
>;

export interface SimuladoQuestaoMetaJoinRow
  extends Pick<
    SimuladoQuestaoRow,
    'id' | 'simulado_id' | 'numero_questao' | 'titulo_questao' | 'resultado'
  > {
  simulado: SimuladoSummaryJoinRow | SimuladoSummaryJoinRow[] | null;
  simulado_pensamentos: SimuladoPensamentoJoinRow[] | null;
}

export interface CadernoErroWithRelationsRow extends CadernoErroRow {
  caderno_erro_temas: CadernoErroTemaJoinRow[] | null;
  simulado_questao:
    | SimuladoQuestaoMetaJoinRow
    | SimuladoQuestaoMetaJoinRow[]
    | null;
}

export function mapSimuladoPensamentoDto(
  row: SimuladoPensamentoJoinRow
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

function comparePensamentosCronologico(
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

function mapCadernoErroSimuladoMeta(
  row: CadernoErroWithRelationsRow
): CadernoErroSimuladoMetaDto | null {
  if (row.origem !== 'SIMULADO' || row.simulado_questao_id === null) {
    return null;
  }

  const questaoRow = unwrapSingleRelation(row.simulado_questao);
  if (!questaoRow) {
    return null;
  }

  const simuladoRow = unwrapSingleRelation(questaoRow.simulado);
  const pensamentosMap = new Map<string, SimuladoPensamentoDto>();

  for (const pensamentoRow of questaoRow.simulado_pensamentos ?? []) {
    pensamentosMap.set(
      pensamentoRow.id,
      mapSimuladoPensamentoDto(pensamentoRow)
    );
  }

  const pensamentos = Array.from(pensamentosMap.values()).sort(
    comparePensamentosCronologico
  );

  return {
    simuladoId: questaoRow.simulado_id,
    simuladoTitulo: simuladoRow?.titulo ?? '',
    simuladoQuestaoId: questaoRow.id,
    numeroQuestao: questaoRow.numero_questao,
    tituloQuestao: questaoRow.titulo_questao,
    resultado: questaoRow.resultado,
    pensamentos,
  };
}

export function mapCadernoErroDto(
  row: CadernoErroWithRelationsRow
): CadernoErroDto {
  const temasMap = new Map<string, TemaSummaryDto>();

  for (const joinRow of row.caderno_erro_temas ?? []) {
    const temaRow = unwrapSingleRelation(joinRow.tema);
    if (temaRow) {
      temasMap.set(temaRow.id, mapTemaSummaryDto(temaRow));
    }
  }

  const temas = Array.from(temasMap.values()).sort(compareTemaByNome);

  return {
    id: row.id,
    userId: row.user_id,
    origem: row.origem,
    status: row.status,
    simuladoQuestaoId: row.simulado_questao_id,
    codigoReferencia: row.codigo_referencia,
    titulo: row.titulo,
    enunciadoCompleto: row.enunciado_completo,
    linkExterno: row.link_externo,
    observacaoErro: row.observacao_erro,
    lastReviewedAt: row.last_reviewed_at,
    lastReviewMode: row.last_review_mode,
    temas,
    simuladoMeta: mapCadernoErroSimuladoMeta(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
