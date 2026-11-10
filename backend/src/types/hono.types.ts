import type { AuthUserDto } from '@shared/types/auth.types';
import type { ValidatedEnv } from '../config/env';
import type { EdgeLogger } from '../config/logger';
import type { AppSupabaseClient } from '../config/supabase';

export type AppBindings = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  CORS_ORIGIN: string;
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
};

export type AppVariables = {
  env: ValidatedEnv;
  logger: EdgeLogger;
  user: AuthUserDto;
  supabase: AppSupabaseClient;
  accessToken: string;
  validBody: unknown;
  validQuery: unknown;
  validParams: unknown;
};

export type AppEnv = {
  Bindings: AppBindings;
  Variables: AppVariables;
};
