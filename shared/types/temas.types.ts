import type { ReviewMode } from './enums.types';

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

export interface ReflexaoDto {
  id: string;
  userId: string;
  temaPrincipalId: string;
  temaPrincipal: TemaSummaryDto;
  temasConectados: TemaSummaryDto[];
  conteudo: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemaDetalheDto extends TemaDto {
  reflexoesProprias: ReflexaoDto[];
  conexoes: ReflexaoDto[];
  totalErrosPendentes: number;
  totalErrosRevisados: number;
}
