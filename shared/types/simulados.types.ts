import type { QuestaoResultado, SimuladoStatus } from './enums.types';
import type { TemaSummaryDto } from './temas.types';

export interface SimuladoPensamentoDto {
  id: string;
  userId: string;
  simuladoQuestaoId: string;
  descricao: string;
  tempoDecorridoSegundos: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SimuladoQuestaoDto {
  id: string;
  userId: string;
  simuladoId: string;
  numeroQuestao: string;
  tituloQuestao: string;
  ordem: number;
  resultado: QuestaoResultado | null;
  observacaoPosRevisao: string | null;
  temas: TemaSummaryDto[];
  pensamentos: SimuladoPensamentoDto[];
  createdAt: string;
  updatedAt: string;
}

export interface SimuladoDto {
  id: string;
  userId: string;
  titulo: string;
  duracaoConfiguradaSegundos: number;
  tempoGastoSegundos: number;
  pdfStoragePath: string | null;
  hasPdf: boolean;
  status: SimuladoStatus;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SimuladoDetalheDto extends SimuladoDto {
  pdfSignedUrl: string | null;
  questoes: SimuladoQuestaoDto[];
}

export interface SimuladoPdfSignedUrlDto {
  signedUrl: string;
  expiresInSeconds: number;
}

export interface SimuladoExportIaDto {
  simuladoId: string;
  titulo: string;
  markdown: string;
}
