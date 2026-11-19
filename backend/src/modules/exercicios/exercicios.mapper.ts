import type { Tables } from '@shared/types/database.types';
import type {
  ExercicioAvulsoDetalheDto,
  ExercicioAvulsoSummaryDto,
} from '@shared/types/exercicios.types';
import type { LousaSignedUrlsDto } from '@shared/types/lousas.types';
import type { TemaSummaryDto } from '@shared/types/temas.types';
import {
  mapLousaSummaryDto,
  type LousaRelationRow,
} from '../lousas/lousas.mapper';
import {
  compareTemaByNome,
  mapTemaSummaryDto,
  unwrapSingleRelation,
  type TemaSummaryRow,
} from '../temas/temas.mapper';

export type ExercicioRow = Tables<'exercicios_avulsos'>;

export interface ExercicioTemaJoinRow {
  tema: TemaSummaryRow | TemaSummaryRow[] | null;
}

export interface ExercicioWithRelationsRow extends ExercicioRow {
  exercicio_temas: ExercicioTemaJoinRow[] | null;
  lousa: LousaRelationRow | LousaRelationRow[] | null;
}

export function mapExercicioAvulsoSummaryDto(
  row: ExercicioWithRelationsRow,
  previewSignedUrlByLousaId?: ReadonlyMap<string, string | null>
): ExercicioAvulsoSummaryDto {
  const temasMap = new Map<string, TemaSummaryDto>();

  for (const joinRow of row.exercicio_temas ?? []) {
    const temaRow = unwrapSingleRelation(joinRow.tema);
    if (temaRow) {
      temasMap.set(temaRow.id, mapTemaSummaryDto(temaRow));
    }
  }

  const temas = Array.from(temasMap.values()).sort(compareTemaByNome);
  const lousaRow = unwrapSingleRelation(row.lousa);
  const lousa = lousaRow
    ? mapLousaSummaryDto(
        lousaRow,
        previewSignedUrlByLousaId?.get(lousaRow.id) ?? null
      )
    : null;

  return {
    id: row.id,
    titulo: row.titulo,
    duracaoSegundos: row.duracao_segundos,
    desfecho: row.desfecho,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    temas,
    lousa,
  };
}

export function mapExercicioAvulsoDetalheDto(
  row: ExercicioWithRelationsRow,
  previewSignedUrlByLousaId?: ReadonlyMap<string, string | null>,
  lousaSignedUrls?: LousaSignedUrlsDto | null
): ExercicioAvulsoDetalheDto {
  const summary = mapExercicioAvulsoSummaryDto(row, previewSignedUrlByLousaId);
  return {
    ...summary,
    enunciado: row.enunciado,
    linkExterno: row.link_externo,
    observacao: row.observacao,
    lousaSignedUrls: lousaSignedUrls ?? null,
  };
}
