import { describe, expect, it } from 'vitest';
import { resolveSignUpStatus } from '@/features/auth/auth.utils';
import { getAuthErrorMessage } from '@/lib/errorMessages';

describe('auth.utils & getAuthErrorMessage', () => {
  it('resolveSignUpStatus retorna authenticated quando há sessão ativa', () => {
    expect(
      resolveSignUpStatus({
        session: { access_token: 'jwt-token' },
        user: null,
      })
    ).toEqual({
      status: 'authenticated',
    });
  });

  it('resolveSignUpStatus detecta cadastro duplicado quando session é null e identities é array vazio', () => {
    expect(
      resolveSignUpStatus({
        session: null,
        user: { identities: [] },
      })
    ).toEqual({
      status: 'already_registered',
    });
  });

  it('resolveSignUpStatus retorna email_confirmation_required para novo cadastro com identities preenchido', () => {
    expect(
      resolveSignUpStatus({
        session: null,
        user: { identities: [{ id: 'identity-1' }] },
      })
    ).toEqual({
      status: 'email_confirmation_required',
    });
  });

  it('getAuthErrorMessage traduz mensagens de cooldown e rate limit do Supabase Auth', () => {
    const cooldownMsg = getAuthErrorMessage({
      message:
        'For security purposes, you can only request this after 48 seconds.',
    });
    expect(cooldownMsg).toBe(
      'Muitas tentativas em sequência. Aguarde alguns instantes antes de tentar novamente.'
    );

    const rateLimitMsg = getAuthErrorMessage({
      message: 'Email rate limit exceeded',
    });
    expect(rateLimitMsg).toBe(
      'Muitas tentativas em sequência. Aguarde alguns instantes antes de tentar novamente.'
    );

    const invalidCredsMsg = getAuthErrorMessage({
      message: 'Invalid login credentials',
    });
    expect(invalidCredsMsg).toBe(
      'E-mail ou senha incorretos. Verifique seus dados e tente novamente.'
    );
  });
});
