import type { ReviewMode } from './enums.types';
import type { LousaSignedUrlsDto, LousaSummaryDto } from './lousas.types';
import type { TemaSummaryDto } from './temas.types';

export interface ExercicioAvulsoSummaryDto {
  id: string;
  titulo: string;
  duracaoSegundos: number;
  desfecho: ReviewMode | null;
  createdAt: string;
  updatedAt: string;
  temas: TemaSummaryDto[];
  lousa: LousaSummaryDto | null;
}

export interface ExercicioAvulsoDetalheDto extends ExercicioAvulsoSummaryDto {
  enunciado: string | null;
  linkExterno: string | null;
  observacao: string | null;
  lousaSignedUrls?: LousaSignedUrlsDto | null;
}

export interface EstudoResumoTemaDto {
  temaId: string;
  nomeTema: string;
  totalExercicios: number;
  totalReflexoes: number;
  tempoTotalSegundos: number;
  desfechos: {
    solo: number;
    help: number;
    semDesfecho: number;
  };
}

export type EstudoItemTipo = 'EXERCICIO' | 'REFLEXAO';

export interface EstudoResumoItemDto {
  tipo: EstudoItemTipo;
  id: string;
  titulo: string;
  createdAt: string;
  duracaoSegundos?: number;
  desfecho?: ReviewMode | null;
  temas: TemaSummaryDto[];
  hasLousa: boolean;
}

export interface EstudosResumoPeriodoDto {
  periodo: 'dia' | 'semana' | 'custom';
  dataReferencia: string; // YYYY-MM-DD
  dataInicioIso: string;
  dataFimIso: string;
  tempoTotalSegundos: number;
  totalExercicios: number;
  totalSolo: number;
  totalHelp: number;
  totalSemDesfecho: number;
  totalReflexoes: number;
  temasAbordados: EstudoResumoTemaDto[];
  itens: EstudoResumoItemDto[];
}

export interface EstudoExportIaDto {
  periodoLabel: string;
  dataInicioIso: string;
  dataFimIso: string;
  markdown: string;
}
