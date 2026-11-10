import { Hono } from 'hono';
import { UuidParamSchema } from '@shared/schemas/common.schema';
import {
  ClassificarQuestaoSimuladoSchema,
  CreateSimuladoPensamentoSchema,
  CreateSimuladoQuestaoSchema,
  CreateSimuladoSchema,
  FinalizarSimuladoSchema,
  SimuladoPensamentoParamsSchema,
  SimuladoQuestaoParamsSchema,
  SimuladosQuerySchema,
  UpdateSimuladoPensamentoSchema,
  UpdateSimuladoQuestaoSchema,
  UpdateSimuladoSchema,
} from '@shared/schemas/simulados.schema';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  validateBody,
  validateParam,
  validateQuery,
} from '../../middlewares/validate.middleware';
import type { AppEnv } from '../../types/hono.types';
import { simuladosController } from './simulados.controller';

const simuladosRoutes = new Hono<AppEnv>();

simuladosRoutes.use('*', authMiddleware);

simuladosRoutes.get('/', validateQuery(SimuladosQuerySchema), (c) =>
  simuladosController.list(c)
);

simuladosRoutes.post('/', validateBody(CreateSimuladoSchema), (c) =>
  simuladosController.create(c)
);

simuladosRoutes.get('/:id', validateParam(UuidParamSchema), (c) =>
  simuladosController.getById(c)
);

simuladosRoutes.patch(
  '/:id',
  validateParam(UuidParamSchema),
  validateBody(UpdateSimuladoSchema),
  (c) => simuladosController.update(c)
);

simuladosRoutes.delete('/:id', validateParam(UuidParamSchema), (c) =>
  simuladosController.remove(c)
);

simuladosRoutes.post('/:id/iniciar', validateParam(UuidParamSchema), (c) =>
  simuladosController.iniciar(c)
);

simuladosRoutes.post(
  '/:id/finalizar',
  validateParam(UuidParamSchema),
  validateBody(FinalizarSimuladoSchema),
  (c) => simuladosController.finalizar(c)
);

simuladosRoutes.post('/:id/pdf', validateParam(UuidParamSchema), (c) =>
  simuladosController.uploadPdf(c)
);

simuladosRoutes.get('/:id/pdf-url', validateParam(UuidParamSchema), (c) =>
  simuladosController.getPdfUrl(c)
);

simuladosRoutes.delete('/:id/pdf', validateParam(UuidParamSchema), (c) =>
  simuladosController.removePdf(c)
);

simuladosRoutes.post(
  '/:id/questoes',
  validateParam(UuidParamSchema),
  validateBody(CreateSimuladoQuestaoSchema),
  (c) => simuladosController.createQuestao(c)
);

simuladosRoutes.patch(
  '/:id/questoes/:questaoId',
  validateParam(SimuladoQuestaoParamsSchema),
  validateBody(UpdateSimuladoQuestaoSchema),
  (c) => simuladosController.updateQuestao(c)
);

simuladosRoutes.delete(
  '/:id/questoes/:questaoId',
  validateParam(SimuladoQuestaoParamsSchema),
  (c) => simuladosController.removeQuestao(c)
);

simuladosRoutes.post(
  '/:id/questoes/:questaoId/classificar',
  validateParam(SimuladoQuestaoParamsSchema),
  validateBody(ClassificarQuestaoSimuladoSchema),
  (c) => simuladosController.classificarQuestao(c)
);

simuladosRoutes.post(
  '/:id/pensamentos',
  validateParam(UuidParamSchema),
  validateBody(CreateSimuladoPensamentoSchema),
  (c) => simuladosController.createPensamento(c)
);

simuladosRoutes.patch(
  '/:id/pensamentos/:pensamentoId',
  validateParam(SimuladoPensamentoParamsSchema),
  validateBody(UpdateSimuladoPensamentoSchema),
  (c) => simuladosController.updatePensamento(c)
);

simuladosRoutes.delete(
  '/:id/pensamentos/:pensamentoId',
  validateParam(SimuladoPensamentoParamsSchema),
  (c) => simuladosController.removePensamento(c)
);

simuladosRoutes.get('/:id/export-ia', validateParam(UuidParamSchema), (c) =>
  simuladosController.exportIa(c)
);

export { simuladosRoutes };
