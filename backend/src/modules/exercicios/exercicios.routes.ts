import { Hono } from 'hono';
import {
  CreateExercicioAvulsoSchema,
  EstudosResumoQuerySchema,
  ListExerciciosQuerySchema,
  UpdateExercicioAvulsoSchema,
} from '@shared/schemas/exercicios.schema';
import { UuidParamSchema } from '@shared/schemas/common.schema';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  validateBody,
  validateParam,
  validateQuery,
} from '../../middlewares/validate.middleware';
import type { AppEnv } from '../../types/hono.types';
import { exerciciosController } from './exercicios.controller';

const exerciciosRoutes = new Hono<AppEnv>();

exerciciosRoutes.use('*', authMiddleware);

exerciciosRoutes.get('/', validateQuery(ListExerciciosQuerySchema), (c) =>
  exerciciosController.list(c)
);

exerciciosRoutes.post('/', validateBody(CreateExercicioAvulsoSchema), (c) =>
  exerciciosController.create(c)
);

// Rotas estáticas antes de /:id para evitar colisões no roteador
exerciciosRoutes.get('/resumo', validateQuery(EstudosResumoQuerySchema), (c) =>
  exerciciosController.getResumo(c)
);

exerciciosRoutes.get('/export-ia', validateQuery(EstudosResumoQuerySchema), (c) =>
  exerciciosController.exportIa(c)
);

exerciciosRoutes.get('/:id', validateParam(UuidParamSchema), (c) =>
  exerciciosController.getById(c)
);

exerciciosRoutes.patch(
  '/:id',
  validateParam(UuidParamSchema),
  validateBody(UpdateExercicioAvulsoSchema),
  (c) => exerciciosController.update(c)
);

exerciciosRoutes.delete('/:id', validateParam(UuidParamSchema), (c) =>
  exerciciosController.remove(c)
);

export { exerciciosRoutes };
