import { Hono } from 'hono';
import {
  CadernoErrosQuerySchema,
  CreateManualErrorSchema,
  RevisarCadernoErroSchema,
  UpdateCadernoErroSchema,
} from '@shared/schemas/caderno-erros.schema';
import { UuidParamSchema } from '@shared/schemas/common.schema';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  validateBody,
  validateParam,
  validateQuery,
} from '../../middlewares/validate.middleware';
import type { AppEnv } from '../../types/hono.types';
import { cadernoErrosController } from './caderno-erros.controller';

const cadernoErrosRoutes = new Hono<AppEnv>();

cadernoErrosRoutes.use('*', authMiddleware);

cadernoErrosRoutes.get('/', validateQuery(CadernoErrosQuerySchema), (c) =>
  cadernoErrosController.list(c)
);

cadernoErrosRoutes.post('/', validateBody(CreateManualErrorSchema), (c) =>
  cadernoErrosController.create(c)
);

cadernoErrosRoutes.post(
  '/:id/revisar',
  validateParam(UuidParamSchema),
  validateBody(RevisarCadernoErroSchema),
  (c) => cadernoErrosController.revisar(c)
);

cadernoErrosRoutes.post(
  '/:id/devolver',
  validateParam(UuidParamSchema),
  (c) => cadernoErrosController.devolver(c)
);

cadernoErrosRoutes.get('/:id', validateParam(UuidParamSchema), (c) =>
  cadernoErrosController.getById(c)
);

cadernoErrosRoutes.patch(
  '/:id',
  validateParam(UuidParamSchema),
  validateBody(UpdateCadernoErroSchema),
  (c) => cadernoErrosController.update(c)
);

cadernoErrosRoutes.delete('/:id', validateParam(UuidParamSchema), (c) =>
  cadernoErrosController.remove(c)
);

export { cadernoErrosRoutes };
