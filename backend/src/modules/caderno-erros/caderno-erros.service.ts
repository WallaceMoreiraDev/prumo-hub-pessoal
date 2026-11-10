import {
  ERROR_CODES,
  type ApiValidationErrorDetail,
  type PaginationMeta,
} from '@shared/types/api.types';
import type {
  CadernoErrosQuery,
  CreateManualErrorInput,
  RevisarCadernoErroInput,
  UpdateCadernoErroInput,
} from '@shared/schemas/caderno-erros.schema';
import type { CadernoErroDto } from '@shared/types/caderno-erros.types';
import type { ErroOrigem } from '@shared/types/enums.types';
import type { AppSupabaseClient } from '../../config/supabase';
import { AppError } from '../../errors/AppError';
import { buildPaginationMeta } from '../../utils/response';
import { unwrapSingleRelation } from '../temas/temas.mapper';
import { temasRepository } from '../temas/temas.repository';
import {
  mapCadernoErroDto,
  type CadernoErroWithRelationsRow,
} from './caderno-erros.mapper';
import {
  cadernoErrosRepository,
  type CadernoErroEditableColumns,
} from './caderno-erros.repository';

export interface ListCadernoErrosResult {
  items: CadernoErroDto[];
  pagination: PaginationMeta;
}

function normalizeNullableText(
  value: string | null | undefined
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveUpdateColumns(
  existing: CadernoErroWithRelationsRow,
  input: UpdateCadernoErroInput
): CadernoErroEditableColumns {
  const details: ApiValidationErrorDetail[] = [];

  if (existing.origem === 'SIMULADO') {
    if (input.codigoReferencia !== undefined) {
      details.push({
        path: 'codigoReferencia',
        message:
          'O código/referência não pode ser alterado em erros originados de simulado.',
      });
    }
    if (input.titulo !== undefined) {
      details.push({
        path: 'titulo',
        message:
          'O título não pode ser alterado em erros originados de simulado.',
      });
    }
    if (input.enunciadoCompleto !== undefined) {
      details.push({
        path: 'enunciadoCompleto',
        message:
          'O enunciado completo não pode ser alterado em erros originados de simulado.',
      });
    }
    if (input.linkExterno !== undefined) {
      details.push({
        path: 'linkExterno',
        message:
          'O link externo não pode ser alterado em erros originados de simulado.',
      });
    }

    if (details.length > 0) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 400, details);
    }

    return {
      codigo_referencia: existing.codigo_referencia,
      titulo: existing.titulo,
      enunciado_completo: existing.enunciado_completo,
      link_externo: existing.link_externo,
      observacao_erro:
        input.observacaoErro !== undefined
          ? normalizeNullableText(input.observacaoErro)
          : existing.observacao_erro,
    };
  }

  if (existing.origem === 'EXTERNAL_LINK') {
    if (
      input.enunciadoCompleto !== undefined &&
      input.enunciadoCompleto !== null
    ) {
      details.push({
        path: 'enunciadoCompleto',
        message:
          'Registros de link externo não permitem preencher enunciado completo.',
      });
    }

    const nextCodigoReferencia =
      input.codigoReferencia !== undefined
        ? normalizeNullableText(input.codigoReferencia)
        : existing.codigo_referencia;
    const nextLinkExterno =
      input.linkExterno !== undefined
        ? normalizeNullableText(input.linkExterno)
        : existing.link_externo;
    const nextTitulo =
      input.titulo !== undefined ? input.titulo.trim() : existing.titulo;
    const nextObservacaoErro =
      input.observacaoErro !== undefined
        ? normalizeNullableText(input.observacaoErro)
        : existing.observacao_erro;

    if (!nextCodigoReferencia) {
      details.push({
        path: 'codigoReferencia',
        message:
          'O código/referência da questão é obrigatório para origem EXTERNAL_LINK.',
      });
    }

    if (!nextLinkExterno) {
      details.push({
        path: 'linkExterno',
        message:
          'O link externo da questão é obrigatório para origem EXTERNAL_LINK.',
      });
    }

    if (!nextTitulo || nextTitulo.trim().length === 0) {
      details.push({
        path: 'titulo',
        message: 'O título da questão não pode estar vazio.',
      });
    }

    if (details.length > 0) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 400, details);
    }

    return {
      codigo_referencia: nextCodigoReferencia,
      titulo: nextTitulo,
      enunciado_completo: null,
      link_externo: nextLinkExterno,
      observacao_erro: nextObservacaoErro,
    };
  }

  // GENERIC_FULL
  if (
    input.codigoReferencia !== undefined &&
    input.codigoReferencia !== null
  ) {
    details.push({
      path: 'codigoReferencia',
      message:
        'Registros de questão genérica completa não utilizam código/referência externo.',
    });
  }

  const nextTitulo =
    input.titulo !== undefined ? input.titulo.trim() : existing.titulo;
  const nextEnunciadoCompleto =
    input.enunciadoCompleto !== undefined
      ? normalizeNullableText(input.enunciadoCompleto)
      : existing.enunciado_completo;
  const nextLinkExterno =
    input.linkExterno !== undefined
      ? normalizeNullableText(input.linkExterno)
      : existing.link_externo;
  const nextObservacaoErro =
    input.observacaoErro !== undefined
      ? normalizeNullableText(input.observacaoErro)
      : existing.observacao_erro;

  if (!nextTitulo || nextTitulo.trim().length === 0) {
    details.push({
      path: 'titulo',
      message: 'O título da questão não pode estar vazio.',
    });
  }

  if (!nextEnunciadoCompleto) {
    details.push({
      path: 'enunciadoCompleto',
      message:
        'O enunciado completo da questão é obrigatório para origem GENERIC_FULL.',
    });
  }

  if (details.length > 0) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, 400, details);
  }

  return {
    codigo_referencia: existing.codigo_referencia,
    titulo: nextTitulo,
    enunciado_completo: nextEnunciadoCompleto,
    link_externo: nextLinkExterno,
    observacao_erro: nextObservacaoErro,
  };
}

export class CadernoErrosService {
  private async ensureAllTemasExist(
    supabase: AppSupabaseClient,
    userId: string,
    temaIds: readonly string[]
  ): Promise<void> {
    const uniqueIds = [...new Set(temaIds)];
    if (uniqueIds.length === 0) {
      throw new AppError(ERROR_CODES.TEMAS_REQUIRED, 400);
    }

    const existingCount = await temasRepository.countTemasByIds(
      supabase,
      userId,
      uniqueIds
    );

    if (existingCount !== uniqueIds.length) {
      throw new AppError(ERROR_CODES.TEMA_NOT_FOUND, 404);
    }
  }

  public async list(
    supabase: AppSupabaseClient,
    userId: string,
    query: CadernoErrosQuery
  ): Promise<ListCadernoErrosResult> {
    const { rows, total } = await cadernoErrosRepository.listPaginated(
      supabase,
      userId,
      query
    );

    return {
      items: rows.map(mapCadernoErroDto),
      pagination: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  public async getById(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<CadernoErroDto> {
    const row = await cadernoErrosRepository.findById(supabase, userId, id);
    if (!row) {
      throw new AppError(ERROR_CODES.CADERNO_ERRO_NOT_FOUND, 404);
    }
    return mapCadernoErroDto(row);
  }

  public async createManual(
    supabase: AppSupabaseClient,
    userId: string,
    input: CreateManualErrorInput
  ): Promise<CadernoErroDto> {
    const origem: ErroOrigem = input.origem;
    if (origem !== 'EXTERNAL_LINK' && origem !== 'GENERIC_FULL') {
      throw new AppError(ERROR_CODES.INVALID_MANUAL_ERROR_ORIGIN, 400);
    }

    const uniqueTemaIds = [...new Set(input.temaIds)];
    await this.ensureAllTemasExist(supabase, userId, uniqueTemaIds);

    const observacaoErro = normalizeNullableText(input.observacaoErro);

    if (input.origem === 'EXTERNAL_LINK') {
      const codigoReferencia = input.codigoReferencia.trim();
      const tituloOpcional = normalizeNullableText(input.titulo);
      const titulo = tituloOpcional ?? codigoReferencia;

      const createdRow = await cadernoErrosRepository.create(supabase, userId, {
        origem: 'EXTERNAL_LINK',
        codigoReferencia,
        titulo,
        enunciadoCompleto: null,
        linkExterno: input.linkExterno,
        observacaoErro,
        temaIds: uniqueTemaIds,
      });

      return mapCadernoErroDto(createdRow);
    }

    const createdRow = await cadernoErrosRepository.create(supabase, userId, {
      origem: 'GENERIC_FULL',
      codigoReferencia: null,
      titulo: input.titulo.trim(),
      enunciadoCompleto: input.enunciadoCompleto.trim(),
      linkExterno: normalizeNullableText(input.linkExterno),
      observacaoErro,
      temaIds: uniqueTemaIds,
    });

    return mapCadernoErroDto(createdRow);
  }

  public async update(
    supabase: AppSupabaseClient,
    userId: string,
    id: string,
    input: UpdateCadernoErroInput
  ): Promise<CadernoErroDto> {
    const existingRow = await cadernoErrosRepository.findById(
      supabase,
      userId,
      id
    );
    if (!existingRow) {
      throw new AppError(ERROR_CODES.CADERNO_ERRO_NOT_FOUND, 404);
    }

    const previousColumns: CadernoErroEditableColumns = {
      codigo_referencia: existingRow.codigo_referencia,
      titulo: existingRow.titulo,
      enunciado_completo: existingRow.enunciado_completo,
      link_externo: existingRow.link_externo,
      observacao_erro: existingRow.observacao_erro,
    };

    const nextColumns = resolveUpdateColumns(existingRow, input);

    let toAddTemaIds: string[] = [];
    let toRemoveTemaIds: string[] = [];

    if (input.temaIds !== undefined) {
      const nextTemaIds = [...new Set(input.temaIds)];
      await this.ensureAllTemasExist(supabase, userId, nextTemaIds);

      const currentTemaIdSet = new Set<string>();
      for (const joinRow of existingRow.caderno_erro_temas ?? []) {
        const temaRow = unwrapSingleRelation(joinRow.tema);
        if (temaRow) {
          currentTemaIdSet.add(temaRow.id);
        }
      }

      const nextTemaSet = new Set(nextTemaIds);
      toAddTemaIds = nextTemaIds.filter(
        (temaId) => !currentTemaIdSet.has(temaId)
      );
      toRemoveTemaIds = [...currentTemaIdSet].filter(
        (temaId) => !nextTemaSet.has(temaId)
      );
    }

    const updatedRow = await cadernoErrosRepository.update(supabase, userId, {
      id,
      previousColumns,
      nextColumns,
      toAddTemaIds,
      toRemoveTemaIds,
    });

    return mapCadernoErroDto(updatedRow);
  }

  public async revisar(
    supabase: AppSupabaseClient,
    userId: string,
    id: string,
    input: RevisarCadernoErroInput
  ): Promise<CadernoErroDto> {
    const updatedRow = await cadernoErrosRepository.concluirRevisaoRpc(
      supabase,
      userId,
      id,
      input.reviewMode
    );
    return mapCadernoErroDto(updatedRow);
  }

  public async devolver(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<CadernoErroDto> {
    const updatedRow = await cadernoErrosRepository.devolverParaPendenteRpc(
      supabase,
      userId,
      id
    );
    return mapCadernoErroDto(updatedRow);
  }

  public async remove(
    supabase: AppSupabaseClient,
    userId: string,
    id: string
  ): Promise<{ id: string }> {
    const deleted = await cadernoErrosRepository.delete(supabase, userId, id);
    if (!deleted) {
      throw new AppError(ERROR_CODES.CADERNO_ERRO_NOT_FOUND, 404);
    }
    return { id: deleted.id };
  }
}

export const cadernoErrosService = new CadernoErrosService();
