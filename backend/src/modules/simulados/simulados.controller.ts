import { ERROR_CODES } from '@shared/types/api.types';
import { SIMULADO_PDF_MAX_SIZE_BYTES } from '@shared/types/simulados.types';
import type { UuidParamInput } from '@shared/schemas/common.schema';
import type {
  ClassificarQuestaoSimuladoInput,
  CreateSimuladoInput,
  CreateSimuladoPensamentoInput,
  CreateSimuladoQuestaoInput,
  FinalizarSimuladoInput,
  SimuladoPensamentoParamsInput,
  SimuladoQuestaoParamsInput,
  SimuladosQuery,
  UpdateSimuladoInput,
  UpdateSimuladoPensamentoInput,
  UpdateSimuladoQuestaoInput,
} from '@shared/schemas/simulados.schema';
import { AppError } from '../../errors/AppError';
import type { ValidatedContext } from '../../types/hono.types';
import { jsonSuccess } from '../../utils/response';
import { simuladosService, type UploadedPdfFile } from './simulados.service';

function isUploadedPdfFile(value: unknown): value is UploadedPdfFile {
  if (typeof File !== 'undefined' && value instanceof File) {
    return true;
  }

  return (
    value !== null &&
    typeof value === 'object' &&
    'size' in value &&
    typeof value.size === 'number' &&
    'type' in value &&
    typeof value.type === 'string' &&
    'arrayBuffer' in value &&
    typeof value.arrayBuffer === 'function'
  );
}

export class SimuladosController {
  public async list(
    c: ValidatedContext<{ validQuery: SimuladosQuery }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const query = c.get('validQuery');

    const { items, pagination } = await simuladosService.list(
      supabase,
      user.id,
      query
    );

    return jsonSuccess(c, items, 200, { pagination });
  }

  public async getById(
    c: ValidatedContext<{ validParams: UuidParamInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const logger = c.get('logger');
    const user = c.get('user');
    const { id } = c.get('validParams');

    const detalhe = await simuladosService.getById(
      supabase,
      logger,
      user.id,
      id
    );
    return jsonSuccess(c, detalhe);
  }

  public async create(
    c: ValidatedContext<{ validBody: CreateSimuladoInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const body = c.get('validBody');

    const created = await simuladosService.create(supabase, user.id, body);
    return jsonSuccess(c, created, 201);
  }

  public async update(
    c: ValidatedContext<{
      validParams: UuidParamInput;
      validBody: UpdateSimuladoInput;
    }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const logger = c.get('logger');
    const user = c.get('user');
    const { id } = c.get('validParams');
    const body = c.get('validBody');

    const updated = await simuladosService.update(
      supabase,
      logger,
      user.id,
      id,
      body
    );
    return jsonSuccess(c, updated);
  }

  public async remove(
    c: ValidatedContext<{ validParams: UuidParamInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const logger = c.get('logger');
    const user = c.get('user');
    const { id } = c.get('validParams');

    const deleted = await simuladosService.remove(
      supabase,
      logger,
      user.id,
      id
    );
    return jsonSuccess(c, deleted);
  }

  public async iniciar(
    c: ValidatedContext<{ validParams: UuidParamInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const logger = c.get('logger');
    const user = c.get('user');
    const { id } = c.get('validParams');

    const started = await simuladosService.iniciar(
      supabase,
      logger,
      user.id,
      id
    );
    return jsonSuccess(c, started);
  }

  public async finalizar(
    c: ValidatedContext<{
      validParams: UuidParamInput;
      validBody: FinalizarSimuladoInput;
    }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const logger = c.get('logger');
    const user = c.get('user');
    const { id } = c.get('validParams');
    const body = c.get('validBody');

    const finished = await simuladosService.finalizar(
      supabase,
      logger,
      user.id,
      id,
      body
    );
    return jsonSuccess(c, finished);
  }

  public async uploadPdf(
    c: ValidatedContext<{ validParams: UuidParamInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const logger = c.get('logger');
    const user = c.get('user');
    const { id } = c.get('validParams');

    await simuladosService.ensurePreparacaoForPdfUpload(supabase, user.id, id);

    const contentLengthHeader = c.req.header('content-length');
    if (contentLengthHeader) {
      const parsedLength = Number(contentLengthHeader);
      if (
        Number.isFinite(parsedLength) &&
        parsedLength > SIMULADO_PDF_MAX_SIZE_BYTES + 2 * 1024 * 1024
      ) {
        throw new AppError(ERROR_CODES.SIMULADO_PDF_TOO_LARGE, 413);
      }
    }

    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = await c.req.parseBody();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
        {
          path: 'file',
          message: 'Corpo multipart inválido ou arquivo ausente no campo file.',
        },
      ]);
    }

    const rawFile = parsedBody['file'];
    if (!isUploadedPdfFile(rawFile)) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
        {
          path: 'file',
          message: 'Envie um arquivo PDF válido no campo "file".',
        },
      ]);
    }

    const updated = await simuladosService.uploadPdf(
      supabase,
      logger,
      user.id,
      id,
      rawFile
    );
    return jsonSuccess(c, updated);
  }

  public async getPdfUrl(
    c: ValidatedContext<{ validParams: UuidParamInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const { id } = c.get('validParams');

    const signedUrlDto = await simuladosService.getPdfUrl(
      supabase,
      user.id,
      id
    );
    return jsonSuccess(c, signedUrlDto);
  }

  public async removePdf(
    c: ValidatedContext<{ validParams: UuidParamInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const logger = c.get('logger');
    const user = c.get('user');
    const { id } = c.get('validParams');

    const updated = await simuladosService.removePdf(
      supabase,
      logger,
      user.id,
      id
    );
    return jsonSuccess(c, updated);
  }

  public async createQuestao(
    c: ValidatedContext<{
      validParams: UuidParamInput;
      validBody: CreateSimuladoQuestaoInput;
    }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const { id } = c.get('validParams');
    const body = c.get('validBody');

    const created = await simuladosService.createQuestao(
      supabase,
      user.id,
      id,
      body
    );
    return jsonSuccess(c, created, 201);
  }

  public async updateQuestao(
    c: ValidatedContext<{
      validParams: SimuladoQuestaoParamsInput;
      validBody: UpdateSimuladoQuestaoInput;
    }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const { id, questaoId } = c.get('validParams');
    const body = c.get('validBody');

    const updated = await simuladosService.updateQuestao(
      supabase,
      user.id,
      id,
      questaoId,
      body
    );
    return jsonSuccess(c, updated);
  }

  public async removeQuestao(
    c: ValidatedContext<{ validParams: SimuladoQuestaoParamsInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const { id, questaoId } = c.get('validParams');

    const deleted = await simuladosService.removeQuestao(
      supabase,
      user.id,
      id,
      questaoId
    );
    return jsonSuccess(c, deleted);
  }

  public async classificarQuestao(
    c: ValidatedContext<{
      validParams: SimuladoQuestaoParamsInput;
      validBody: ClassificarQuestaoSimuladoInput;
    }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const { id, questaoId } = c.get('validParams');
    const body = c.get('validBody');

    const updated = await simuladosService.classificarQuestao(
      supabase,
      user.id,
      id,
      questaoId,
      body
    );
    return jsonSuccess(c, updated);
  }

  public async createPensamento(
    c: ValidatedContext<{
      validParams: UuidParamInput;
      validBody: CreateSimuladoPensamentoInput;
    }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const { id } = c.get('validParams');
    const body = c.get('validBody');

    const created = await simuladosService.createPensamento(
      supabase,
      user.id,
      id,
      body
    );
    return jsonSuccess(c, created, 201);
  }

  public async updatePensamento(
    c: ValidatedContext<{
      validParams: SimuladoPensamentoParamsInput;
      validBody: UpdateSimuladoPensamentoInput;
    }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const { id, pensamentoId } = c.get('validParams');
    const body = c.get('validBody');

    const updated = await simuladosService.updatePensamento(
      supabase,
      user.id,
      id,
      pensamentoId,
      body
    );
    return jsonSuccess(c, updated);
  }

  public async removePensamento(
    c: ValidatedContext<{ validParams: SimuladoPensamentoParamsInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const { id, pensamentoId } = c.get('validParams');

    const deleted = await simuladosService.removePensamento(
      supabase,
      user.id,
      id,
      pensamentoId
    );
    return jsonSuccess(c, deleted);
  }

  public async exportIa(
    c: ValidatedContext<{ validParams: UuidParamInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const { id } = c.get('validParams');

    const exported = await simuladosService.exportIa(supabase, user.id, id);
    return jsonSuccess(c, exported);
  }
}

export const simuladosController = new SimuladosController();
