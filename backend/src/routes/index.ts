import { Hono } from 'hono';
import { authRoutes } from '../modules/auth/auth.routes';
import { healthRoutes } from '../modules/health/health.routes';
import type { AppEnv } from '../types/hono.types';

const apiV1Routes = new Hono<AppEnv>();

apiV1Routes.route('/health', healthRoutes);
apiV1Routes.route('/auth', authRoutes);

export { apiV1Routes };
