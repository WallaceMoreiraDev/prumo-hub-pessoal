import type { UuidParamInput } from '@shared/schemas/common.schema';
import type {
  CreateReflexaoInput,
  UpdateReflexaoInput,
} from '@shared/schemas/temas.schema';
import type { ValidatedContext } from '../../types/hono.types';
import { jsonSuccess } from '../../utils/response';
import { temasService } from './temas.service';

export class ReflexoesController {
  public async getById(
    c: ValidatedContext<{ validParams: UuidParamInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const logger = c.get('logger');
    const { id } = c.get('validParams');

    const reflexao = await temasService.getReflexaoById(
      supabase,
      user.id,
      id,
      logger
    );
    return jsonSuccess(c, reflexao);
  }

  public async create(
    c: ValidatedContext<{ validBody: CreateReflexaoInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const logger = c.get('logger');
    const body = c.get('validBody');

    const created = await temasService.createReflexao(
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
      validBody: UpdateReflexaoInput;
    }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const logger = c.get('logger');
    const { id } = c.get('validParams');
    const body = c.get('validBody');

    const updated = await temasService.updateReflexao(
      supabase,
      user.id,
      id,
      body,
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

    const deleted = await temasService.deleteReflexao(
      supabase,
      user.id,
      id,
      logger
    );
    return jsonSuccess(c, deleted);
  }
}

export const reflexoesController = new ReflexoesController();
