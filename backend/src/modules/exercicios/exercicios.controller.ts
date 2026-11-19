import type { UuidParamInput } from '@shared/schemas/common.schema';
import type {
  CreateExercicioAvulsoInput,
  EstudosResumoQuery,
  ListExerciciosQuery,
  UpdateExercicioAvulsoInput,
} from '@shared/schemas/exercicios.schema';
import type { ValidatedContext } from '../../types/hono.types';
import { jsonSuccess } from '../../utils/response';
import { exerciciosService } from './exercicios.service';

export class ExerciciosController {
  public async create(
    c: ValidatedContext<{ validBody: CreateExercicioAvulsoInput }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const logger = c.get('logger');
    const body = c.get('validBody');

    const created = await exerciciosService.create(
      supabase,
      user.id,
      body,
      logger
    );
    return jsonSuccess(c, created, 201);
  }

  public async list(
    c: ValidatedContext<{ validQuery: ListExerciciosQuery }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const logger = c.get('logger');
    const query = c.get('validQuery');

    const { items, pagination } = await exerciciosService.list(
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

    const exercicio = await exerciciosService.getById(
      supabase,
      user.id,
      id,
      logger
    );
    return jsonSuccess(c, exercicio);
  }

  public async update(
    c: ValidatedContext<{
      validParams: UuidParamInput;
      validBody: UpdateExercicioAvulsoInput;
    }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const logger = c.get('logger');
    const { id } = c.get('validParams');
    const body = c.get('validBody');

    const updated = await exerciciosService.update(
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

    const deleted = await exerciciosService.delete(
      supabase,
      user.id,
      id,
      logger
    );
    return jsonSuccess(c, deleted);
  }

  public async getResumo(
    c: ValidatedContext<{ validQuery: EstudosResumoQuery }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const query = c.get('validQuery');

    const resumo = await exerciciosService.getResumoPeriodo(
      supabase,
      user.id,
      query
    );
    return jsonSuccess(c, resumo);
  }

  public async exportIa(
    c: ValidatedContext<{ validQuery: EstudosResumoQuery }>
  ): Promise<Response> {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const query = c.get('validQuery');

    const relatorio = await exerciciosService.exportIa(
      supabase,
      user.id,
      query
    );
    return jsonSuccess(c, relatorio);
  }
}

export const exerciciosController = new ExerciciosController();
