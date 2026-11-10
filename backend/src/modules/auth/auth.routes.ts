import { Hono } from 'hono';
import { authMiddleware } from '../../middlewares/auth.middleware';
import type { AppEnv } from '../../types/hono.types';
import { authController } from './auth.controller';

const authRoutes = new Hono<AppEnv>();

authRoutes.get('/me', authMiddleware, (c) => authController.getMe(c));

export { authRoutes };
