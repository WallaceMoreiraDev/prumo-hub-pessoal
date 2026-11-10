import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/config/env';

let supabaseAuthClient: SupabaseClient | null = null;

/**
 * Instância única do cliente Supabase restrita exclusivamente à autenticação (`supabase.auth.*`).
 * Operações de domínio são proibidas no Frontend e devem passar pelo BFF Hono (`apiClient`).
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseAuthClient) {
    return supabaseAuthClient;
  }

  const env = getEnv();

  supabaseAuthClient = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'prumo-supabase-auth',
      },
    }
  );

  return supabaseAuthClient;
}
