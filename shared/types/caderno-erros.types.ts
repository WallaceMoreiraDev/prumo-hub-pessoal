import type {
  ErroOrigem,
  ErroStatus,
  QuestaoResultado,
  ReviewMode,
} from './enums.types';
import type { SimuladoPensamentoDto } from './simulados.types';
import type { TemaSummaryDto } from './temas.types';

export interface CadernoErroSimuladoMetaDto {
  simuladoId: string;
  simuladoTitulo: string;
  simuladoQuestaoId: string;
  numeroQuestao: string;
  tituloQuestao: string;
  resultado: QuestaoResultado | null;
  pensamentos: SimuladoPensamentoDto[];
}

export interface CadernoErroDto {
  id: string;
  userId: string;
  origem: ErroOrigem;
  status: ErroStatus;
  simuladoQuestaoId: string | null;
  codigoReferencia: string | null;
  titulo: string;
  enunciadoCompleto: string | null;
  linkExterno: string | null;
  observacaoErro: string | null;
  lastReviewedAt: string | null;
  lastReviewMode: ReviewMode | null;
  temas: TemaSummaryDto[];
  simuladoMeta: CadernoErroSimuladoMetaDto | null;
  createdAt: string;
  updatedAt: string;
}
