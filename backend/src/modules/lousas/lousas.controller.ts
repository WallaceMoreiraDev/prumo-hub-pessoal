import type { Context } from 'hono';
import type { LousaParamInput } from '@shared/schemas/lousas.schema';
import { ERROR_CODES } from '@shared/types/api.types';
import { LOUSA_MAX_TOTAL_SIZE_BYTES } from '@shared/types/lousas.types';
import { AppError } from '../../errors/AppError';
import type { AppEnv, ValidatedContext } from '../../types/hono.types';
import { jsonSuccess } from '../../utils/response';
import { lousasService, type LousaMultipartInput } from './lousas.service';

const MAX_MULTIPART_CONTENT_LENGTH_BYTES = LOUSA_MAX_TOTAL_SIZE_BYTES + 256 * 1024;

interface MultipartReadableRequest {
  header(name: string): string | undefined;
  formData(): Promise<FormData>;
}

function isUploadedFile(value: unknown): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as File).arrayBuffer === 'function' &&
    typeof (value as File).size === 'number'
  );
}

async function parseLousaMultipartFiles(
  req: MultipartReadableRequest
): Promise<LousaMultipartInput> {
  const rawContentLength = req.header('content-length');
  if (rawContentLength !== undefined) {
    const parsedLength = Number(rawContentLength);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_MULTIPART_CONTENT_LENGTH_BYTES) {
      throw new AppError(ERROR_CODES.LOUSA_TOO_LARGE, 413);
    }
  }

  const contentType = (req.header('content-type') ?? '').toLowerCase();
  if (!contentType.includes('multipart/form-data')) {
    throw new AppError(ERROR_CODES.LOUSA_INVALID_PAYLOAD, 400, [
      {
        path: 'body',
        message: 'Envie os arquivos scene e preview em multipart/form-data.',
      },
    ]);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    throw new AppError(ERROR_CODES.LOUSA_INVALID_PAYLOAD, 400, [
      {
        path: 'body',
        message: 'Falha ao processar payload multipart/form-data da lousa.',
      },
    ]);
  }

  const scene = formData.get('scene');
  if (!isUploadedFile(scene)) {
    throw new AppError(ERROR_CODES.LOUSA_INVALID_PAYLOAD, 400, [
      {
        path: 'scene',
        message: 'O arquivo JSON da cena (scene) é obrigatório.',
      },
    ]);
  }

  const preview = formData.get('preview');
  if (!isUploadedFile(preview)) {
    throw new AppError(ERROR_CODES.LOUSA_INVALID_PAYLOAD, 400, [
      {
        path: 'preview',
        message: 'A imagem de pré-visualização (preview) é obrigatória.',
      },
    ]);
  }

  return { sceneFile: scene, previewFile: preview };
}

export class LousasController {
  async create(c: Context<AppEnv>): Promise<Response> {
    const user = c.get('user');
    const supabase = c.get('supabase');
    const logger = c.get('logger');
    const files = await parseLousaMultipartFiles(c.req);

    const created = await lousasService.create(supabase, user.id, files, logger);
    return jsonSuccess(c, created, 201);
  }

  async getById(
    c: ValidatedContext<{ validParams: LousaParamInput }>
  ): Promise<Response> {
    const user = c.get('user');
    const supabase = c.get('supabase');
    const logger = c.get('logger');
    const { id } = c.get('validParams');

    const lousa = await lousasService.getById(supabase, user.id, id, logger);
    return jsonSuccess(c, lousa);
  }

  async getUrls(
    c: ValidatedContext<{ validParams: LousaParamInput }>
  ): Promise<Response> {
    const user = c.get('user');
    const supabase = c.get('supabase');
    const logger = c.get('logger');
    const { id } = c.get('validParams');

    const urls = await lousasService.getUrls(supabase, user.id, id, logger);
    return jsonSuccess(c, urls);
  }

  async update(
    c: ValidatedContext<{ validParams: LousaParamInput }>
  ): Promise<Response> {
    const user = c.get('user');
    const supabase = c.get('supabase');
    const logger = c.get('logger');
    const { id } = c.get('validParams');
    const files = await parseLousaMultipartFiles(c.req);

    const updated = await lousasService.update(
      supabase,
      user.id,
      id,
      files,
      logger
    );
    return jsonSuccess(c, updated);
  }

  async remove(
    c: ValidatedContext<{ validParams: LousaParamInput }>
  ): Promise<Response> {
    const user = c.get('user');
    const supabase = c.get('supabase');
    const logger = c.get('logger');
    const { id } = c.get('validParams');

    const result = await lousasService.remove(supabase, user.id, id, logger);
    return jsonSuccess(c, result);
  }
}

export const lousasController = new LousasController();
