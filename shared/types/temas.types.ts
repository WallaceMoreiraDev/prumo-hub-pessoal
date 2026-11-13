import type { ReviewMode } from './enums.types';
import type { LousaSummaryDto } from './lousas.types';

export type TemaSortBy = 'oldest_review' | 'recent_review' | 'name_asc';

export const TEMA_SORT_OPTIONS = [
  'oldest_review',
  'recent_review',
  'name_asc',
] as const satisfies readonly TemaSortBy[];

export interface TemaSummaryDto {
  id: string;
  nome: string;
  lastReviewedAt: string | null;
  lastReviewMode: ReviewMode | null;
}

export interface TemaDto {
  id: string;
  userId: string;
  nome: string;
  lastReviewedAt: string | null;
  lastReviewMode: ReviewMode | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemaListItemDto extends TemaDto {
  totalReflexoes: number;
  totalConexoes: number;
  temasConectadosResumo: TemaSummaryDto[];
}

export interface ReflexaoDto {
  id: string;
  userId: string;
  temaPrincipalId: string;
  temaPrincipal: TemaSummaryDto;
  temasConectados: TemaSummaryDto[];
  conteudo: string | null;
  lousaId: string | null;
  lousa: LousaSummaryDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemaDetalheDto extends TemaDto {
  reflexoesProprias: ReflexaoDto[];
  conexoes: ReflexaoDto[];
  totalErrosPendentes: number;
  totalErrosRevisados: number;
}
