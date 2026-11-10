import { z } from 'zod';

const FrontendEnvSchema = z.object({
  VITE_SUPABASE_URL: z
    .string({ error: 'Variável VITE_SUPABASE_URL não configurada.' })
    .trim()
    .min(1, { error: 'Variável VITE_SUPABASE_URL não pode estar vazia.' })
    .pipe(
      z.url({
        protocol: /^https?$/,
        error: 'VITE_SUPABASE_URL deve ser uma URL HTTP/HTTPS válida.',
      })
    ),
  VITE_SUPABASE_ANON_KEY: z
    .string({ error: 'Variável VITE_SUPABASE_ANON_KEY não configurada.' })
    .trim()
    .min(1, { error: 'Variável VITE_SUPABASE_ANON_KEY não pode estar vazia.' }),
  VITE_API_URL: z
    .string({ error: 'Variável VITE_API_URL não configurada.' })
    .trim()
    .min(1, { error: 'Variável VITE_API_URL não pode estar vazia.' })
    .pipe(
      z.url({
        protocol: /^https?$/,
        error: 'VITE_API_URL deve ser uma URL HTTP/HTTPS válida.',
      })
    )
    .transform((url) => url.replace(/\/+$/, '')),
});

export type FrontendEnv = z.infer<typeof FrontendEnvSchema>;

export interface EnvValidationIssue {
  variable: string;
  message: string;
}

export type EnvValidationResult =
  | { success: true; data: FrontendEnv }
  | { success: false; issues: EnvValidationIssue[] };

function validateFrontendEnv(): EnvValidationResult {
  const parsed = FrontendEnvSchema.safeParse({
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_API_URL: import.meta.env.VITE_API_URL,
  });

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  return {
    success: false,
    issues: parsed.error.issues.map((issue) => ({
      variable:
        issue.path[0] !== undefined ? String(issue.path[0]) : 'AMBIENTE',
      message: issue.message,
    })),
  };
}

export const envValidation: EnvValidationResult = validateFrontendEnv();

export function getEnv(): FrontendEnv {
  if (!envValidation.success) {
    const missingList = envValidation.issues
      .map((issue) => `${issue.variable}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuração de ambiente inválida: ${missingList}`);
  }

  return envValidation.data;
}
