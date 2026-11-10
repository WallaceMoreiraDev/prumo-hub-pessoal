import { Hono } from 'hono';
import { UuidParamSchema } from '@shared/schemas/common.schema';
import {
  CreateReflexaoSchema,
  UpdateReflexaoSchema,
} from '@shared/schemas/temas.schema';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  validateBody,
  validateParam,
} from '../../middlewares/validate.middleware';
import type { AppEnv } from '../../types/hono.types';
import { reflexoesController } from './reflexoes.controller';

const reflexoesRoutes = new Hono<AppEnv>();

reflexoesRoutes.use('*', authMiddleware);

reflexoesRoutes.post('/', validateBody(CreateReflexaoSchema), (c) =>
  reflexoesController.create(c)
);

reflexoesRoutes.get('/:id', validateParam(UuidParamSchema), (c) =>
  reflexoesController.getById(c)
);

reflexoesRoutes.patch(
  '/:id',
  validateParam(UuidParamSchema),
  validateBody(UpdateReflexaoSchema),
  (c) => reflexoesController.update(c)
);

reflexoesRoutes.delete('/:id', validateParam(UuidParamSchema), (c) =>
  reflexoesController.remove(c)
);

export { reflexoesRoutes };
