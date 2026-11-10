import { Hono } from 'hono';
import { UuidParamSchema } from '@shared/schemas/common.schema';
import {
  CreateTemaSchema,
  RegistrarPraticaSchema,
  TemasQuerySchema,
  UpdateTemaSchema,
} from '@shared/schemas/temas.schema';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  validateBody,
  validateParam,
  validateQuery,
} from '../../middlewares/validate.middleware';
import type { AppEnv } from '../../types/hono.types';
import { temasController } from './temas.controller';

const temasRoutes = new Hono<AppEnv>();

temasRoutes.use('*', authMiddleware);

temasRoutes.get('/', validateQuery(TemasQuerySchema), (c) =>
  temasController.list(c)
);

temasRoutes.post('/pratica', validateBody(RegistrarPraticaSchema), (c) =>
  temasController.registrarPratica(c)
);

temasRoutes.post('/', validateBody(CreateTemaSchema), (c) =>
  temasController.create(c)
);

temasRoutes.get('/:id', validateParam(UuidParamSchema), (c) =>
  temasController.getById(c)
);

temasRoutes.patch(
  '/:id',
  validateParam(UuidParamSchema),
  validateBody(UpdateTemaSchema),
  (c) => temasController.update(c)
);

temasRoutes.delete('/:id', validateParam(UuidParamSchema), (c) =>
  temasController.remove(c)
);

export { temasRoutes };
