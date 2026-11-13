import type { UuidParamInput } from '@shared/schemas/common.schema';
import type {
  CreateTemaInput,
  RegistrarPraticaInput,
  TemasQuery,
  UpdateTemaInput,
} from '@shared/schemas/temas.schema';
import type { ValidatedContext } from '../../types/hono.types';
import { jsonSuccess } from '../../utils/response';
import { temasService } from './temas.service';

export class TemasController {
  public async list(
    c: ValidatedContext<{ validQuery: TemasQuery }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const query = c.get('validQuery');

    const { items, pagination } = await temasService.listTemas(
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
    const user = c.get('user');
    const logger = c.get('logger');
    const { id } = c.get('validParams');

    const temaDetalhe = await temasService.getTemaById(
      supabase,
      user.id,
      id,
      logger
    );
    return jsonSuccess(c, temaDetalhe);
  }

  public async create(
    c: ValidatedContext<{ validBody: CreateTemaInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const body = c.get('validBody');

    const created = await temasService.createTema(supabase, user.id, body);
    return jsonSuccess(c, created, 201);
  }

  public async update(
    c: ValidatedContext<{
      validParams: UuidParamInput;
      validBody: UpdateTemaInput;
    }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const { id } = c.get('validParams');
    const body = c.get('validBody');

    const updated = await temasService.updateTema(supabase, user.id, id, body);
    return jsonSuccess(c, updated);
  }

  public async remove(
    c: ValidatedContext<{ validParams: UuidParamInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const logger = c.get('logger');
    const { id } = c.get('validParams');

    const deleted = await temasService.deleteTema(
      supabase,
      user.id,
      id,
      logger
    );
    return jsonSuccess(c, deleted);
  }

  public async registrarPratica(
    c: ValidatedContext<{ validBody: RegistrarPraticaInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const body = c.get('validBody');

    const updatedTemas = await temasService.registrarPratica(
      supabase,
      user.id,
      body
    );
    return jsonSuccess(c, updatedTemas);
  }
}

export const temasController = new TemasController();
