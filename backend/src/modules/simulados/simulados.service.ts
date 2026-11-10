import { ERROR_CODES, type PaginationMeta } from '@shared/types/api.types';
import { QUESTAO_RESULTADOS, type QuestaoResultado } from '@shared/types/enums.types';
import {
  SIMULADO_PDF_MAX_SIZE_BYTES,
  SIMULADO_PDF_SIGNED_URL_TTL_SECONDS,
  type SimuladoDetalheDto,
  type SimuladoExportIaDto,
  type SimuladoListItemDto,
  type SimuladoPdfSignedUrlDto,
  type SimuladoPensamentoDto,
  type SimuladoQuestaoDto,
} from '@shared/types/simulados.types';
import type {
  ClassificarQuestaoSimuladoInput,
  CreateSimuladoInput,
  CreateSimuladoPensamentoInput,
  CreateSimuladoQuestaoInput,
  FinalizarSimuladoInput,
  SimuladosQuery,
  UpdateSimuladoInput,
  UpdateSimuladoPensamentoInput,
  UpdateSimuladoQuestaoInput,
} from '@shared/schemas/simulados.schema';
import type { EdgeLogger } from '../../config/logger';
import type { AppSupabaseClient } from '../../config/supabase';
import { AppError } from '../../errors/AppError';
import { buildPaginationMeta } from '../../utils/response';
import {
  isStorageNotFoundError,
  mapSupabaseStorageError,
} from '../../utils/supabaseErrorMapper';
import { unwrapSingleRelation } from '../temas/temas.mapper';
import {
  mapSimuladoDetalheDto,
  mapSimuladoListItemDto,
  mapSimuladoPensamentoDto,
  mapSimuladoQuestaoDto,
  type SimuladoRow,
  type SimuladoWithRelationsRow,
} from './simulados.mapper';
import { simuladosRepository } from './simulados.repository';

export interface ListSimuladosResult {
  items: SimuladoListItemDto[];
  pagination: PaginationMeta;
}

export interface UploadedPdfFile {
  readonly size: number;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

const ALLOWED_PDF_MIME_TYPES = new Set<string>([
  '',
  'application/pdf',
  'application/x-pdf',
  'application/octet-stream',
]);

const PDF_HEADER_SCAN_LIMIT = 1024;
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;

const RESULTADO_LABELS: Readonly<Record<QuestaoResultado, string>> = {
  [QUESTAO_RESULTADOS[0]]: 'Acertei',
  [QUESTAO_RESULTADOS[1]]: 'Parcial',
  [QUESTAO_RESULTADOS[2]]: 'Errei',
};

function hasValidPdfMagicBytes(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  const limit = Math.min(bytes.length, PDF_HEADER_SCAN_LIMIT);
  let offset = 0;

  if (
    limit >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    offset = 3;
  }

  while (offset < limit) {
    const byte = bytes[offset];
    if (
      byte === 0x20 ||
      byte === 0x09 ||
      byte === 0x0a ||
      byte === 0x0c ||
      byte === 0x0d
    ) {
      offset += 1;
      continue;
    }
    break;
  }

  if (offset + PDF_MAGIC_BYTES.length > limit) {
    return false;
  }

  for (let i = 0; i < PDF_MAGIC_BYTES.length; i += 1) {
    if (bytes[offset + i] !== PDF_MAGIC_BYTES[i]) {
      return false;
    }
  }

  return true;
}

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDurationClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`;
}

function formatThoughtTimestamp(seconds: number | null): string {
  if (seconds === null) {
    return '[--:--]';
  }
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = safe % 60;
  if (hours > 0) {
    return `[${padTwo(hours)}:${padTwo(minutes)}:${padTwo(remainingSeconds)}]`;
  }
  return `[${padTwo(minutes)}:${padTwo(remainingSeconds)}]`;
}

function sanitizeHeadingText(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim();
}

function formatIndentedMultiline(value: string, indent = '  '): string {
  const normalized = value.replace(/\r\n/g, '\n').trim();
  const lines = normalized.split('\n');
  if (lines.length <= 1) {
    return normalized;
  }
  return lines
    .map((line, index) => (index === 0 ? line : `${indent}${line}`))
    .join('\n');
}

function buildSimuladoExportMarkdown(detalhe: SimuladoDetalheDto): string {
  let totalAcertos = 0;
  let totalParciais = 0;
  let totalErros = 0;
  let totalNaoClassificadas = 0;

  for (const questao of detalhe.questoes) {
    if (questao.resultado === 'ACERTEI') {
      totalAcertos += 1;
    } else if (questao.resultado === 'PARCIAL') {
      totalParciais += 1;
    } else if (questao.resultado === 'ERREI') {
      totalErros += 1;
    } else {
      totalNaoClassificadas += 1;
    }
  }

  const lines: string[] = [
    `# Revisão de Simulado: ${sanitizeHeadingText(detalhe.titulo)}`,
    '',
    '## Resumo Geral',
    `- **Status:** Finalizado`,
    `- **Duração configurada:** ${formatDurationClock(detalhe.duracaoConfiguradaSegundos)}`,
    `- **Tempo gasto:** ${formatDurationClock(detalhe.tempoGastoSegundos)}`,
    `- **Total de questões:** ${detalhe.questoes.length}`,
    `- **Acertos:** ${totalAcertos}`,
    `- **Parciais:** ${totalParciais}`,
    `- **Erros:** ${totalErros}`,
    `- **Não classificadas:** ${totalNaoClassificadas}`,
    '',
    '## Questões',
  ];

  if (detalhe.questoes.length === 0) {
    lines.push('', 'Nenhuma questão registrada neste simulado.');
    return lines.join('\n');
  }

  for (const questao of detalhe.questoes) {
    const resultadoLabel = questao.resultado
      ? RESULTADO_LABELS[questao.resultado]
      : 'Não classificada';
    const temasTexto =
      questao.temas.length > 0
        ? questao.temas.map((tema) => tema.nome).join(', ')
        : 'Nenhum tema vinculado';

    lines.push(
      '',
      `### Questão ${sanitizeHeadingText(questao.numeroQuestao)} — ${sanitizeHeadingText(questao.tituloQuestao)}`,
      `- **Resultado:** ${resultadoLabel}`,
      `- **Temas:** ${temasTexto}`
    );

    if (questao.pensamentos.length === 0) {
      lines.push(
        '- **Pensamentos durante a prova:** Nenhum pensamento registrado.'
      );
    } else {
      lines.push('- **Pensamentos durante a prova:**');
      for (const pensamento of questao.pensamentos) {
        const stamp = formatThoughtTimestamp(pensamento.tempoDecorridoSegundos);
        lines.push(
          `  - \`${stamp}\` ${formatIndentedMultiline(pensamento.descricao, '    ')}`
        );
      }
    }

    if (questao.observacaoPosRevisao !== null) {
      lines.push(
        `- **Observação Pós-Revisão:** ${formatIndentedMultiline(questao.observacaoPosRevisao, '  ')}`
      );
    }
  }

  return lines.join('\n');
}

export class SimuladosService {
  private async resolveExistingSimulado(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<SimuladoRow> {
    const existing = await simuladosRepository.findSummaryById(
      supabase,
      userId,
      id
    );
    if (!existing) {
      throw new AppError(ERROR_CODES.SIMULADO_NOT_FOUND, 404);
    }
    return existing;
  }

  private async resolveTransitionFailure(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<never> {
    const current = await simuladosRepository.findSummaryById(
      supabase,
      userId,
      id
    );
    if (!current) {
      throw new AppError(ERROR_CODES.SIMULADO_NOT_FOUND, 404);
    }
    throw new AppError(ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION, 409);
  }

  private async hydrateDetalhe(
    supabase: AppSupabaseClient,
    logger: EdgeLogger,
    userId: string,
    row: SimuladoWithRelationsRow
  ): Promise<SimuladoDetalheDto> {
    let pdfSignedUrl: string | null = null;

    if (row.pdf_storage_path !== null) {
      const { signedUrl, error } =
        await simuladosRepository.createPdfSignedUrl(
          supabase,
          row.pdf_storage_path,
          SIMULADO_PDF_SIGNED_URL_TTL_SECONDS
        );

      if (error !== null) {
        if (isStorageNotFoundError(error)) {
          logger.warn(
            'PDF ausente no Storage ao gerar signed URL de detalhes do simulado',
            {
              simuladoId: row.id,
              userId,
              storagePath: row.pdf_storage_path,
              storageError: error.message,
              storageStatus: error.status,
              storageStatusCode: error.statusCode,
            }
          );
          pdfSignedUrl = null;
        } else {
          throw mapSupabaseStorageError(error);
        }
      } else {
        pdfSignedUrl = signedUrl;
      }
    }

    return mapSimuladoDetalheDto(row, pdfSignedUrl);
  }

  public async list(
    supabase: AppSupabaseClient,
    userId: string,
    query: SimuladosQuery
  ): Promise<ListSimuladosResult> {
    const { rows, total } = await simuladosRepository.listPaginated(
      supabase,
      userId,
      query
    );

    const simuladoIds = rows.map((row) => row.id);
    const metricsMap = await simuladosRepository.getBatchListMetrics(
      supabase,
      userId,
      simuladoIds
    );

    return {
      items: rows.map((row) =>
        mapSimuladoListItemDto(row, metricsMap.get(row.id))
      ),
      pagination: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  public async getById(
    supabase: AppSupabaseClient,
    logger: EdgeLogger,
    userId: string,
    id: string
  ): Promise<SimuladoDetalheDto> {
    const row = await simuladosRepository.findDetalheById(supabase, userId, id);
    if (!row) {
      throw new AppError(ERROR_CODES.SIMULADO_NOT_FOUND, 404);
    }

    return this.hydrateDetalhe(supabase, logger, userId, row);
  }

  public async create(
    supabase: AppSupabaseClient,
    userId: string,
    input: CreateSimuladoInput
  ): Promise<SimuladoDetalheDto> {
    const createdRow = await simuladosRepository.createSimulado(
      supabase,
      userId,
      {
        titulo: input.titulo,
        duracaoConfiguradaSegundos: input.duracaoConfiguradaSegundos,
      }
    );

    return mapSimuladoDetalheDto(
      {
        ...createdRow,
        simulado_questoes: [],
      },
      null
    );
  }

  public async update(
    supabase: AppSupabaseClient,
    logger: EdgeLogger,
    userId: string,
    id: string,
    input: UpdateSimuladoInput
  ): Promise<SimuladoDetalheDto> {
    const existing = await this.resolveExistingSimulado(supabase, userId, id);

    if (existing.status === 'EM_ANDAMENTO') {
      throw new AppError(ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION, 409);
    }

    if (
      existing.status === 'FINALIZADO' &&
      input.duracaoConfiguradaSegundos !== undefined
    ) {
      throw new AppError(ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION, 409);
    }

    const updated = await simuladosRepository.updateSimuladoMetadata(
      supabase,
      userId,
      id,
      existing.status,
      {
        ...(input.titulo !== undefined ? { titulo: input.titulo } : {}),
        ...(input.duracaoConfiguradaSegundos !== undefined
          ? { duracao_configurada_segundos: input.duracaoConfiguradaSegundos }
          : {}),
      }
    );

    if (!updated) {
      await this.resolveTransitionFailure(supabase, userId, id);
    }

    const detalhe = await simuladosRepository.findDetalheById(
      supabase,
      userId,
      id
    );
    if (!detalhe) {
      throw new AppError(ERROR_CODES.SIMULADO_NOT_FOUND, 404);
    }

    return this.hydrateDetalhe(supabase, logger, userId, detalhe);
  }

  public async remove(
    supabase: AppSupabaseClient,
    logger: EdgeLogger,
    userId: string,
    id: string
  ): Promise<{ id: string }> {
    const deleted = await simuladosRepository.deleteSimulado(
      supabase,
      userId,
      id
    );
    if (!deleted) {
      throw new AppError(ERROR_CODES.SIMULADO_NOT_FOUND, 404);
    }

    if (deleted.pdf_storage_path !== null) {
      await simuladosRepository.removePdfBestEffort(
        supabase,
        logger,
        deleted.pdf_storage_path,
        {
          simuladoId: id,
          userId,
          reason: 'delete-simulado',
        }
      );
    }

    return { id: deleted.id };
  }

  public async iniciar(
    supabase: AppSupabaseClient,
    logger: EdgeLogger,
    userId: string,
    id: string
  ): Promise<SimuladoDetalheDto> {
    const existing = await this.resolveExistingSimulado(supabase, userId, id);

    if (existing.status !== 'PREPARACAO') {
      throw new AppError(ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION, 409);
    }

    const totalQuestoes = await simuladosRepository.countQuestoesBySimulado(
      supabase,
      userId,
      id
    );
    if (totalQuestoes < 1) {
      throw new AppError(ERROR_CODES.SIMULADO_REQUIRES_QUESTAO, 400);
    }

    const startedAtIso = new Date().toISOString();
    const transitioned = await simuladosRepository.transitionToEmAndamento(
      supabase,
      userId,
      id,
      startedAtIso
    );

    if (!transitioned) {
      await this.resolveTransitionFailure(supabase, userId, id);
    }

    const detalhe = await simuladosRepository.findDetalheById(
      supabase,
      userId,
      id
    );
    if (!detalhe) {
      throw new AppError(ERROR_CODES.SIMULADO_NOT_FOUND, 404);
    }

    return this.hydrateDetalhe(supabase, logger, userId, detalhe);
  }

  public async finalizar(
    supabase: AppSupabaseClient,
    logger: EdgeLogger,
    userId: string,
    id: string,
    input: FinalizarSimuladoInput
  ): Promise<SimuladoDetalheDto> {
    const existing = await this.resolveExistingSimulado(supabase, userId, id);

    if (existing.status !== 'EM_ANDAMENTO') {
      throw new AppError(ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION, 409);
    }

    const nowDate = new Date();
    const finishedAtIso = nowDate.toISOString();
    const startedMs = existing.started_at
      ? Date.parse(existing.started_at)
      : Number.NaN;
    const clampedStartedAtIso =
      !Number.isNaN(startedMs) && nowDate.getTime() < startedMs
        ? finishedAtIso
        : undefined;

    const transitioned = await simuladosRepository.transitionToFinalizado(
      supabase,
      userId,
      id,
      {
        finishedAtIso,
        tempoGastoSegundos: input.tempoGastoSegundos,
        ...(clampedStartedAtIso !== undefined ? { clampedStartedAtIso } : {}),
      }
    );

    if (!transitioned) {
      await this.resolveTransitionFailure(supabase, userId, id);
    }

    const detalhe = await simuladosRepository.findDetalheById(
      supabase,
      userId,
      id
    );
    if (!detalhe) {
      throw new AppError(ERROR_CODES.SIMULADO_NOT_FOUND, 404);
    }

    return this.hydrateDetalhe(supabase, logger, userId, detalhe);
  }

  public async ensurePreparacaoForPdfUpload(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<SimuladoRow> {
    const existing = await this.resolveExistingSimulado(supabase, userId, id);
    if (existing.status !== 'PREPARACAO') {
      throw new AppError(ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION, 409);
    }
    return existing;
  }

  public async uploadPdf(
    supabase: AppSupabaseClient,
    logger: EdgeLogger,
    userId: string,
    id: string,
    file: UploadedPdfFile
  ): Promise<SimuladoDetalheDto> {
    const existing = await this.ensurePreparacaoForPdfUpload(
      supabase,
      userId,
      id
    );

    if (file.size === 0) {
      throw new AppError(ERROR_CODES.SIMULADO_PDF_INVALID_TYPE, 400);
    }

    if (file.size > SIMULADO_PDF_MAX_SIZE_BYTES) {
      throw new AppError(ERROR_CODES.SIMULADO_PDF_TOO_LARGE, 413);
    }

    const normalizedMime =
      (file.type ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    if (!ALLOWED_PDF_MIME_TYPES.has(normalizedMime)) {
      throw new AppError(ERROR_CODES.SIMULADO_PDF_INVALID_TYPE, 400);
    }

    const fileBuffer = await file.arrayBuffer();

    if (fileBuffer.byteLength === 0) {
      throw new AppError(ERROR_CODES.SIMULADO_PDF_INVALID_TYPE, 400);
    }

    if (fileBuffer.byteLength > SIMULADO_PDF_MAX_SIZE_BYTES) {
      throw new AppError(ERROR_CODES.SIMULADO_PDF_TOO_LARGE, 413);
    }

    if (!hasValidPdfMagicBytes(fileBuffer)) {
      throw new AppError(ERROR_CODES.SIMULADO_PDF_INVALID_TYPE, 400);
    }

    const storagePath = `${userId}/simulados/${id}/${crypto.randomUUID()}.pdf`;
    await simuladosRepository.uploadPdf(supabase, storagePath, fileBuffer);

    let updated = false;
    try {
      updated = await simuladosRepository.updatePdfStoragePath(
        supabase,
        userId,
        id,
        storagePath,
        'PREPARACAO'
      );
    } catch (err) {
      await simuladosRepository.removePdfBestEffort(
        supabase,
        logger,
        storagePath,
        {
          simuladoId: id,
          userId,
          reason: 'rollback-upload-db-error',
        }
      );
      throw err;
    }

    if (!updated) {
      await simuladosRepository.removePdfBestEffort(
        supabase,
        logger,
        storagePath,
        {
          simuladoId: id,
          userId,
          reason: 'rollback-upload-status-race',
        }
      );
      await this.resolveTransitionFailure(supabase, userId, id);
    }

    if (
      existing.pdf_storage_path !== null &&
      existing.pdf_storage_path !== storagePath
    ) {
      await simuladosRepository.removePdfBestEffort(
        supabase,
        logger,
        existing.pdf_storage_path,
        {
          simuladoId: id,
          userId,
          reason: 'replace-previous-pdf',
        }
      );
    }

    const detalhe = await simuladosRepository.findDetalheById(
      supabase,
      userId,
      id
    );
    if (!detalhe) {
      throw new AppError(ERROR_CODES.SIMULADO_NOT_FOUND, 404);
    }

    return this.hydrateDetalhe(supabase, logger, userId, detalhe);
  }

  public async getPdfUrl(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<SimuladoPdfSignedUrlDto> {
    const existing = await this.resolveExistingSimulado(supabase, userId, id);

    if (existing.pdf_storage_path === null) {
      throw new AppError(ERROR_CODES.SIMULADO_PDF_NOT_FOUND, 404);
    }

    const { signedUrl, error } = await simuladosRepository.createPdfSignedUrl(
      supabase,
      existing.pdf_storage_path,
      SIMULADO_PDF_SIGNED_URL_TTL_SECONDS
    );

    if (error !== null) {
      throw mapSupabaseStorageError(error);
    }

    if (!signedUrl) {
      throw new AppError(ERROR_CODES.SIMULADO_PDF_NOT_FOUND, 404);
    }

    return {
      signedUrl,
      expiresInSeconds: SIMULADO_PDF_SIGNED_URL_TTL_SECONDS,
    };
  }

  public async removePdf(
    supabase: AppSupabaseClient,
    logger: EdgeLogger,
    userId: string,
    id: string
  ): Promise<SimuladoDetalheDto> {
    const existing = await this.resolveExistingSimulado(supabase, userId, id);

    if (existing.status !== 'PREPARACAO') {
      throw new AppError(ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION, 409);
    }

    if (existing.pdf_storage_path === null) {
      throw new AppError(ERROR_CODES.SIMULADO_PDF_NOT_FOUND, 404);
    }

    const previousStoragePath = existing.pdf_storage_path;
    const updated = await simuladosRepository.updatePdfStoragePath(
      supabase,
      userId,
      id,
      null,
      'PREPARACAO'
    );

    if (!updated) {
      await this.resolveTransitionFailure(supabase, userId, id);
    }

    await simuladosRepository.removePdfBestEffort(
      supabase,
      logger,
      previousStoragePath,
      {
        simuladoId: id,
        userId,
        reason: 'delete-simulado-pdf',
      }
    );

    const detalhe = await simuladosRepository.findDetalheById(
      supabase,
      userId,
      id
    );
    if (!detalhe) {
      throw new AppError(ERROR_CODES.SIMULADO_NOT_FOUND, 404);
    }

    return this.hydrateDetalhe(supabase, logger, userId, detalhe);
  }

  public async createQuestao(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoId: string,
    input: CreateSimuladoQuestaoInput
  ): Promise<SimuladoQuestaoDto> {
    const existing = await this.resolveExistingSimulado(
      supabase,
      userId,
      simuladoId
    );
    if (existing.status !== 'PREPARACAO') {
      throw new AppError(ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION, 409);
    }

    const ordem =
      input.ordem !== undefined
        ? input.ordem
        : await simuladosRepository.getNextQuestaoOrdem(
            supabase,
            userId,
            simuladoId
          );

    const createdRow = await simuladosRepository.createQuestao(
      supabase,
      userId,
      simuladoId,
      {
        numeroQuestao: input.numeroQuestao,
        tituloQuestao: input.tituloQuestao,
        ordem,
      }
    );

    return mapSimuladoQuestaoDto(createdRow);
  }

  public async updateQuestao(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoId: string,
    questaoId: string,
    input: UpdateSimuladoQuestaoInput
  ): Promise<SimuladoQuestaoDto> {
    const existing = await this.resolveExistingSimulado(
      supabase,
      userId,
      simuladoId
    );
    if (existing.status !== 'PREPARACAO') {
      throw new AppError(ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION, 409);
    }

    const updatedRow = await simuladosRepository.updateQuestao(
      supabase,
      userId,
      simuladoId,
      questaoId,
      {
        ...(input.numeroQuestao !== undefined
          ? { numero_questao: input.numeroQuestao }
          : {}),
        ...(input.tituloQuestao !== undefined
          ? { titulo_questao: input.tituloQuestao }
          : {}),
        ...(input.ordem !== undefined ? { ordem: input.ordem } : {}),
      }
    );

    if (!updatedRow) {
      throw new AppError(ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND, 404);
    }

    return mapSimuladoQuestaoDto(updatedRow);
  }

  public async removeQuestao(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoId: string,
    questaoId: string
  ): Promise<{ id: string }> {
    const existing = await this.resolveExistingSimulado(
      supabase,
      userId,
      simuladoId
    );
    if (existing.status !== 'PREPARACAO') {
      throw new AppError(ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION, 409);
    }

    const deleted = await simuladosRepository.deleteQuestao(
      supabase,
      userId,
      simuladoId,
      questaoId
    );
    if (!deleted) {
      throw new AppError(ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND, 404);
    }

    return { id: deleted.id };
  }

  public async classificarQuestao(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoId: string,
    questaoId: string,
    input: ClassificarQuestaoSimuladoInput
  ): Promise<SimuladoQuestaoDto> {
    const existing = await this.resolveExistingSimulado(
      supabase,
      userId,
      simuladoId
    );
    if (existing.status !== 'FINALIZADO') {
      throw new AppError(ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION, 409);
    }

    const questaoBelongs = await simuladosRepository.questaoExistsInSimulado(
      supabase,
      userId,
      simuladoId,
      questaoId
    );
    if (!questaoBelongs) {
      throw new AppError(ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND, 404);
    }

    const uniqueTemaIds = [...new Set(input.temaIds)];
    const observacaoPosRevisao =
      input.resultado === 'ACERTEI' ? null : input.observacaoPosRevisao;

    const hydratedRow = await simuladosRepository.classificarQuestaoRpc(
      supabase,
      userId,
      simuladoId,
      questaoId,
      {
        resultado: input.resultado,
        temaIds: uniqueTemaIds,
        observacaoPosRevisao,
      }
    );

    return mapSimuladoQuestaoDto(hydratedRow);
  }

  public async createPensamento(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoId: string,
    input: CreateSimuladoPensamentoInput
  ): Promise<SimuladoPensamentoDto> {
    const existing = await this.resolveExistingSimulado(
      supabase,
      userId,
      simuladoId
    );
    if (existing.status !== 'EM_ANDAMENTO') {
      throw new AppError(ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION, 409);
    }

    const questaoBelongs = await simuladosRepository.questaoExistsInSimulado(
      supabase,
      userId,
      simuladoId,
      input.simuladoQuestaoId
    );
    if (!questaoBelongs) {
      throw new AppError(ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND, 404);
    }

    const createdRow = await simuladosRepository.createPensamento(
      supabase,
      userId,
      {
        simuladoQuestaoId: input.simuladoQuestaoId,
        descricao: input.descricao,
        tempoDecorridoSegundos: input.tempoDecorridoSegundos ?? null,
      }
    );

    return mapSimuladoPensamentoDto(createdRow);
  }

  public async updatePensamento(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoId: string,
    pensamentoId: string,
    input: UpdateSimuladoPensamentoInput
  ): Promise<SimuladoPensamentoDto> {
    const existingSimulado = await this.resolveExistingSimulado(
      supabase,
      userId,
      simuladoId
    );
    if (existingSimulado.status === 'PREPARACAO') {
      throw new AppError(ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION, 409);
    }

    const existingPensamento =
      await simuladosRepository.findPensamentoWithSimulado(
        supabase,
        userId,
        pensamentoId
      );
    const parentQuestao = unwrapSingleRelation(
      existingPensamento?.simulado_questao
    );

    if (!existingPensamento || parentQuestao?.simulado_id !== simuladoId) {
      throw new AppError(ERROR_CODES.SIMULADO_PENSAMENTO_NOT_FOUND, 404);
    }

    if (input.simuladoQuestaoId !== undefined) {
      const questaoBelongs = await simuladosRepository.questaoExistsInSimulado(
        supabase,
        userId,
        simuladoId,
        input.simuladoQuestaoId
      );
      if (!questaoBelongs) {
        throw new AppError(ERROR_CODES.SIMULADO_QUESTAO_NOT_FOUND, 404);
      }
    }

    const updatedRow = await simuladosRepository.updatePensamento(
      supabase,
      userId,
      pensamentoId,
      {
        ...(input.simuladoQuestaoId !== undefined
          ? { simulado_questao_id: input.simuladoQuestaoId }
          : {}),
        ...(input.descricao !== undefined
          ? { descricao: input.descricao }
          : {}),
        ...(input.tempoDecorridoSegundos !== undefined
          ? { tempo_decorrido_segundos: input.tempoDecorridoSegundos }
          : {}),
      }
    );

    if (!updatedRow) {
      throw new AppError(ERROR_CODES.SIMULADO_PENSAMENTO_NOT_FOUND, 404);
    }

    return mapSimuladoPensamentoDto(updatedRow);
  }

  public async removePensamento(
    supabase: AppSupabaseClient,
    userId: string,
    simuladoId: string,
    pensamentoId: string
  ): Promise<{ id: string }> {
    const existingSimulado = await this.resolveExistingSimulado(
      supabase,
      userId,
      simuladoId
    );
    if (existingSimulado.status === 'PREPARACAO') {
      throw new AppError(ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION, 409);
    }

    const existingPensamento =
      await simuladosRepository.findPensamentoWithSimulado(
        supabase,
        userId,
        pensamentoId
      );
    const parentQuestao = unwrapSingleRelation(
      existingPensamento?.simulado_questao
    );

    if (!existingPensamento || parentQuestao?.simulado_id !== simuladoId) {
      throw new AppError(ERROR_CODES.SIMULADO_PENSAMENTO_NOT_FOUND, 404);
    }

    const deleted = await simuladosRepository.deletePensamento(
      supabase,
      userId,
      pensamentoId
    );
    if (!deleted) {
      throw new AppError(ERROR_CODES.SIMULADO_PENSAMENTO_NOT_FOUND, 404);
    }

    return { id: deleted.id };
  }

  public async exportIa(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<SimuladoExportIaDto> {
    const row = await simuladosRepository.findDetalheById(supabase, userId, id);
    if (!row) {
      throw new AppError(ERROR_CODES.SIMULADO_NOT_FOUND, 404);
    }

    if (row.status !== 'FINALIZADO') {
      throw new AppError(ERROR_CODES.SIMULADO_INVALID_STATUS_TRANSITION, 409);
    }

    const detalhe = mapSimuladoDetalheDto(row, null);
    const markdown = buildSimuladoExportMarkdown(detalhe);

    return {
      simuladoId: detalhe.id,
      titulo: detalhe.titulo,
      markdown,
    };
  }
}

export const simuladosService = new SimuladosService();
