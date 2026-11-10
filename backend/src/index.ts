import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { validateEnv } from './config/env';
import { createLogger } from './config/logger';
import { errorHandler, notFoundHandler } from './errors/errorHandler';
import { apiV1Routes } from './routes';
import type { AppEnv } from './types/hono.types';

const app = new Hono<AppEnv>();

app.use('*', secureHeaders());

app.use('*', async (c, next) => {
  const startedAt = Date.now();
  const env = validateEnv(c.env);
  const logger = createLogger(env.LOG_LEVEL);

  c.set('env', env);
  c.set('logger', logger);

  await next();

  const durationMs = Date.now() - startedAt;
  const user = c.get('user');

  logger.info('HTTP request completed', {
    method: c.req.method,
    path: c.req.path,
    statusCode: c.res.status,
    durationMs,
    ...(user ? { userId: user.id } : {}),
  });
});

app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      const env = validateEnv(c.env);
      return env.allowedCorsOrigins.includes(origin) ? origin : null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 600,
  })
);

app.route('/api/v1', apiV1Routes);

app.notFound(notFoundHandler);
app.onError(errorHandler);

export default app;
