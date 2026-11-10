import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@shared/types/database.types';
import type { ValidatedEnv } from './env';

export type AppSupabaseClient = SupabaseClient<Database>;

export function createSupabaseUserClient(
  env: ValidatedEnv,
  accessToken?: string
): AppSupabaseClient {
  const headers: Record<string, string> = {
    apikey: env.SUPABASE_ANON_KEY,
  };

  if (accessToken && accessToken.trim().length > 0) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers,
    },
  });
}
