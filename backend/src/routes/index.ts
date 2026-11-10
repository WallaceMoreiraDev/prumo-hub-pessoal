import { Hono } from 'hono';
import { authRoutes } from '../modules/auth/auth.routes';
import { healthRoutes } from '../modules/health/health.routes';
import { reflexoesRoutes } from '../modules/temas/reflexoes.routes';
import { temasRoutes } from '../modules/temas/temas.routes';
import type { AppEnv } from '../types/hono.types';

const apiV1Routes = new Hono<AppEnv>();

apiV1Routes.route('/health', healthRoutes);
apiV1Routes.route('/auth', authRoutes);
apiV1Routes.route('/temas', temasRoutes);
apiV1Routes.route('/reflexoes', reflexoesRoutes);

export { apiV1Routes };
