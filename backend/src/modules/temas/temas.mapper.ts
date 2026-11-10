import type { Tables } from '@shared/types/database.types';
import type {
  ReflexaoDto,
  TemaDetalheDto,
  TemaDto,
  TemaListItemDto,
  TemaSummaryDto,
} from '@shared/types/temas.types';

export type TemaRow = Tables<'temas'>;
export type ReflexaoRow = Tables<'reflexoes'>;

export type TemaSummaryRow = Pick<
  TemaRow,
  'id' | 'nome' | 'last_reviewed_at' | 'last_review_mode'
>;

export interface ReflexaoConectadoJoinRow {
  tema_conectado: TemaSummaryRow | TemaSummaryRow[] | null;
}

export interface ReflexaoWithRelationsRow extends ReflexaoRow {
  tema_principal: TemaSummaryRow | TemaSummaryRow[] | null;
  reflexao_temas_conectados: ReflexaoConectadoJoinRow[] | null;
}

export function unwrapSingleRelation<T>(
  value: T | T[] | null | undefined
): T | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

export function compareTemaByNome(
  a: Pick<TemaSummaryDto, 'nome'>,
  b: Pick<TemaSummaryDto, 'nome'>
): number {
  const primary = a.nome.localeCompare(b.nome, 'pt-BR', {
    sensitivity: 'base',
  });
  if (primary !== 0) {
    return primary;
  }
  return a.nome.localeCompare(b.nome);
}

export function mapTemaSummaryDto(row: TemaSummaryRow): TemaSummaryDto {
  return {
    id: row.id,
    nome: row.nome,
    lastReviewedAt: row.last_reviewed_at,
    lastReviewMode: row.last_review_mode,
  };
}

export function mapTemaDto(row: TemaRow): TemaDto {
  return {
    id: row.id,
    userId: row.user_id,
    nome: row.nome,
    lastReviewedAt: row.last_reviewed_at,
    lastReviewMode: row.last_review_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTemaListItemDto(
  row: TemaRow,
  metrics?: {
    totalReflexoes: number;
    totalConexoes: number;
    temasConectadosResumo: TemaSummaryDto[];
  }
): TemaListItemDto {
  return {
    ...mapTemaDto(row),
    totalReflexoes: metrics?.totalReflexoes ?? 0,
    totalConexoes: metrics?.totalConexoes ?? 0,
    temasConectadosResumo: metrics?.temasConectadosResumo ?? [],
  };
}

export function mapReflexaoDto(row: ReflexaoWithRelationsRow): ReflexaoDto {
  const temaPrincipalRow = unwrapSingleRelation(row.tema_principal);

  const temaPrincipal: TemaSummaryDto = temaPrincipalRow
    ? mapTemaSummaryDto(temaPrincipalRow)
    : {
        id: row.tema_principal_id,
        nome: '',
        lastReviewedAt: null,
        lastReviewMode: null,
      };

  const conectadosMap = new Map<string, TemaSummaryDto>();
  for (const joinRow of row.reflexao_temas_conectados ?? []) {
    const conectadoRow = unwrapSingleRelation(joinRow.tema_conectado);
    if (conectadoRow && conectadoRow.id !== row.tema_principal_id) {
      conectadosMap.set(conectadoRow.id, mapTemaSummaryDto(conectadoRow));
    }
  }

  const temasConectados = Array.from(conectadosMap.values()).sort(
    compareTemaByNome
  );

  return {
    id: row.id,
    userId: row.user_id,
    temaPrincipalId: row.tema_principal_id,
    temaPrincipal,
    temasConectados,
    conteudo: row.conteudo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTemaDetalheDto(
  temaRow: TemaRow,
  reflexoesProprias: ReflexaoDto[],
  conexoes: ReflexaoDto[],
  totalErrosPendentes: number,
  totalErrosRevisados: number
): TemaDetalheDto {
  return {
    ...mapTemaDto(temaRow),
    reflexoesProprias,
    conexoes,
    totalErrosPendentes,
    totalErrosRevisados,
  };
}
