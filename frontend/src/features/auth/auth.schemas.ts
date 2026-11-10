import { z } from 'zod';

export const LoginSchema = z.object({
  email: z
    .string({ error: 'Informe seu endereço de e-mail.' })
    .trim()
    .min(1, { error: 'O e-mail é obrigatório.' })
    .pipe(z.email({ error: 'Informe um endereço de e-mail válido.' })),
  password: z
    .string({ error: 'Informe sua senha.' })
    .min(1, { error: 'A senha é obrigatória.' }),
});

export const SignUpSchema = z
  .object({
    email: z
      .string({ error: 'Informe seu endereço de e-mail.' })
      .trim()
      .min(1, { error: 'O e-mail é obrigatório.' })
      .pipe(z.email({ error: 'Informe um endereço de e-mail válido.' })),
    password: z
      .string({ error: 'Informe uma senha.' })
      .min(6, { error: 'A senha deve ter pelo menos 6 caracteres.' })
      .max(72, { error: 'A senha deve ter no máximo 72 caracteres.' }),
    confirmPassword: z
      .string({ error: 'Confirme a senha informada.' })
      .min(1, { error: 'A confirmação de senha é obrigatória.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    error: 'As senhas informadas não conferem.',
  });

export type LoginFormInput = z.infer<typeof LoginSchema>;
export type SignUpFormInput = z.infer<typeof SignUpSchema>;
