import type { UuidParamInput } from '@shared/schemas/common.schema';
import type {
  CadernoErrosQuery,
  CreateManualErrorInput,
  RevisarCadernoErroInput,
  UpdateCadernoErroInput,
} from '@shared/schemas/caderno-erros.schema';
import type { ValidatedContext } from '../../types/hono.types';
import { jsonSuccess } from '../../utils/response';
import { cadernoErrosService } from './caderno-erros.service';

export class CadernoErrosController {
  public async list(
    c: ValidatedContext<{ validQuery: CadernoErrosQuery }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const logger = c.get('logger');
    const query = c.get('validQuery');

    const { items, pagination } = await cadernoErrosService.list(
      supabase,
      user.id,
      query,
      logger
    );

    return jsonSuccess(c, items, 200, { pagination });
  }

  public async getById(
    c: ValidatedContext<{ validParams: UuidParamInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const logger = c.get('logger');
    const { id } = c.get('validParams');

    const item = await cadernoErrosService.getById(
      supabase,
      user.id,
      id,
      logger
    );
    return jsonSuccess(c, item);
  }

  public async create(
    c: ValidatedContext<{ validBody: CreateManualErrorInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const logger = c.get('logger');
    const body = c.get('validBody');

    const created = await cadernoErrosService.createManual(
      supabase,
      user.id,
      body,
      logger
    );
    return jsonSuccess(c, created, 201);
  }

  public async update(
    c: ValidatedContext<{
      validParams: UuidParamInput;
      validBody: UpdateCadernoErroInput;
    }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const logger = c.get('logger');
    const { id } = c.get('validParams');
    const body = c.get('validBody');

    const updated = await cadernoErrosService.update(
      supabase,
      user.id,
      id,
      body,
      logger
    );
    return jsonSuccess(c, updated);
  }

  public async revisar(
    c: ValidatedContext<{
      validParams: UuidParamInput;
      validBody: RevisarCadernoErroInput;
    }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const logger = c.get('logger');
    const { id } = c.get('validParams');
    const body = c.get('validBody');

    const updated = await cadernoErrosService.revisar(
      supabase,
      user.id,
      id,
      body,
      logger
    );
    return jsonSuccess(c, updated);
  }

  public async devolver(
    c: ValidatedContext<{ validParams: UuidParamInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const logger = c.get('logger');
    const { id } = c.get('validParams');

    const updated = await cadernoErrosService.devolver(
      supabase,
      user.id,
      id,
      logger
    );
    return jsonSuccess(c, updated);
  }

  public async remove(
    c: ValidatedContext<{ validParams: UuidParamInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const logger = c.get('logger');
    const { id } = c.get('validParams');

    const deleted = await cadernoErrosService.remove(
      supabase,
      user.id,
      id,
      logger
    );
    return jsonSuccess(c, deleted);
  }
}

export const cadernoErrosController = new CadernoErrosController();
