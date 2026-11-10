import type { MiddlewareHandler } from 'hono';
import { ERROR_CODES } from '@shared/types/api.types';
import type { AuthUserDto } from '@shared/types/auth.types';
import { validateEnv } from '../config/env';
import { createSupabaseUserClient } from '../config/supabase';
import { AppError } from '../errors/AppError';
import type { AppEnv } from '../types/hono.types';

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const parts = authorizationHeader.trim().split(/\s+/);
  if (parts.length !== 2) {
    return null;
  }

  const [scheme, token] = parts;
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const env = c.get('env') ?? validateEnv(c.env);
  c.set('env', env);

  const token = extractBearerToken(c.req.header('Authorization'));
  if (!token) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, 401);
  }

  const supabase = createSupabaseUserClient(env, token);

  let userResponse: Awaited<ReturnType<typeof supabase.auth.getUser>>;
  try {
    userResponse = await supabase.auth.getUser(token);
  } catch {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, 401);
  }

  if (userResponse.error || !userResponse.data.user) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, 401);
  }

  const supaUser = userResponse.data.user;
  const authUser: AuthUserDto = {
    id: supaUser.id,
    email: supaUser.email ?? null,
    role: supaUser.role ?? null,
    createdAt: supaUser.created_at ?? null,
    lastSignInAt: supaUser.last_sign_in_at ?? null,
  };

  c.set('user', authUser);
  c.set('supabase', supabase);
  c.set('accessToken', token);

  await next();
};
