export type SignUpStatus =
  | 'authenticated'
  | 'email_confirmation_required'
  | 'already_registered';

export interface SignUpResult {
  status: SignUpStatus;
}

export interface SignUpResponseData {
  session: { access_token: string } | null;
  user: { identities?: ReadonlyArray<unknown> | null } | null;
}

/**
 * Distingue os 3 desfechos do `supabase.auth.signUp`:
 * 1) Sessão imediata (`authenticated`);
 * 2) Proteção anti-enumeração do Supabase para e-mail já cadastrado e confirmado
 *    (`session === null` e `user.identities` vazio);
 * 3) Novo cadastro aguardando confirmação de e-mail (`email_confirmation_required`).
 */
export function resolveSignUpStatus(data: SignUpResponseData): SignUpResult {
  if (data.session) {
    return { status: 'authenticated' };
  }

  if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
    return { status: 'already_registered' };
  }

  return { status: 'email_confirmation_required' };
}
