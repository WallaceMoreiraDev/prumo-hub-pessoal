import { Hono } from 'hono';
import { LousaParamSchema } from '@shared/schemas/lousas.schema';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validateParam } from '../../middlewares/validate.middleware';
import type { AppEnv } from '../../types/hono.types';
import { lousasController } from './lousas.controller';

const lousasRoutes = new Hono<AppEnv>();

lousasRoutes.use('*', authMiddleware);

lousasRoutes.post('/', (c) => lousasController.create(c));

lousasRoutes.get('/:id', validateParam(LousaParamSchema), (c) =>
  lousasController.getById(c)
);

lousasRoutes.get('/:id/urls', validateParam(LousaParamSchema), (c) =>
  lousasController.getUrls(c)
);

lousasRoutes.patch('/:id', validateParam(LousaParamSchema), (c) =>
  lousasController.update(c)
);

lousasRoutes.delete('/:id', validateParam(LousaParamSchema), (c) =>
  lousasController.remove(c)
);

export { lousasRoutes };
