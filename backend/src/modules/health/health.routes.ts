import { Hono } from 'hono';
import type { AppEnv } from '../../types/hono.types';
import { healthController } from './health.controller';

const healthRoutes = new Hono<AppEnv>();

healthRoutes.get('/', (c) => healthController.getHealth(c));

export { healthRoutes };
