import { Hono } from 'hono';
import { authRoutes } from '../modules/auth/auth.routes';
import { cadernoErrosRoutes } from '../modules/caderno-erros/caderno-erros.routes';
import { healthRoutes } from '../modules/health/health.routes';
import { lousasRoutes } from '../modules/lousas/lousas.routes';
import { reflexoesRoutes } from '../modules/temas/reflexoes.routes';
import { simuladosRoutes } from '../modules/simulados/simulados.routes';
import { temasRoutes } from '../modules/temas/temas.routes';
import type { AppEnv } from '../types/hono.types';

const apiV1Routes = new Hono<AppEnv>();

apiV1Routes.route('/health', healthRoutes);
apiV1Routes.route('/auth', authRoutes);
apiV1Routes.route('/temas', temasRoutes);
apiV1Routes.route('/reflexoes', reflexoesRoutes);
apiV1Routes.route('/caderno-erros', cadernoErrosRoutes);
apiV1Routes.route('/simulados', simuladosRoutes);
apiV1Routes.route('/lousas', lousasRoutes);

export { apiV1Routes };
