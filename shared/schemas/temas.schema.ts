import { z } from 'zod';
import { REVIEW_MODES } from '../types/enums.types';
import { TEMA_SORT_OPTIONS } from '../types/temas.types';
import { PaginationQuerySchema, UuidSchema } from './common.schema';

export const TemaNomeSchema = z
  .string({ error: 'O nome do tema é obrigatório.' })
  .trim()
  .min(1, { error: 'O nome do tema não pode estar vazio.' })
  .max(80, { error: 'O nome do tema deve ter no máximo 80 caracteres.' })
  .refine((value) => !value.includes('#'), {
    error: 'O nome do tema não pode conter o caractere "#".',
  });

export const CreateTemaSchema = z.object({
  nome: TemaNomeSchema,
});

export const UpdateTemaSchema = z.object({
  nome: TemaNomeSchema,
});

export const TemasQuerySchema = PaginationQuerySchema.extend({
  sortBy: z
    .enum(TEMA_SORT_OPTIONS, {
      error:
        'Ordenação inválida. Utilize oldest_review, recent_review ou name_asc.',
    })
    .default('oldest_review'),
  reviewMode: z
    .enum(REVIEW_MODES, {
      error: 'Modo de revisão inválido. Utilize SOLO ou HELP.',
    })
    .optional(),
});

export const RegistrarPraticaSchema = z.object({
  temaIds: z
    .array(UuidSchema, { error: 'Informe a lista de temas praticados.' })
    .min(1, { error: 'Selecione pelo menos um tema.' })
    .max(50, { error: 'Selecione no máximo 50 temas por registro.' }),
  reviewMode: z.enum(REVIEW_MODES, {
    error: 'Modo de revisão inválido. Utilize SOLO ou HELP.',
  }),
});

export const CreateReflexaoSchema = z
  .object({
    temaPrincipalId: UuidSchema,
    temaConectadoIds: z
      .array(UuidSchema)
      .max(30, { error: 'Selecione no máximo 30 temas conectados.' })
      .optional()
      .default([]),
    conteudo: z
      .string({ error: 'O conteúdo da reflexão é obrigatório.' })
      .trim()
      .min(1, { error: 'O conteúdo da reflexão não pode estar vazio.' })
      .max(5000, { error: 'O conteúdo deve ter no máximo 5000 caracteres.' }),
  })
  .refine((data) => !data.temaConectadoIds.includes(data.temaPrincipalId), {
    path: ['temaConectadoIds'],
    error: 'O tema principal não pode estar na lista de temas conectados.',
  });

export const UpdateReflexaoSchema = z
  .object({
    temaPrincipalId: UuidSchema.optional(),
    temaConectadoIds: z
      .array(UuidSchema)
      .max(30, { error: 'Selecione no máximo 30 temas conectados.' })
      .optional(),
    conteudo: z
      .string()
      .trim()
      .min(1, { error: 'O conteúdo da reflexão não pode estar vazio.' })
      .max(5000, { error: 'O conteúdo deve ter no máximo 5000 caracteres.' })
      .optional(),
  })
  .refine(
    (data) =>
      data.temaPrincipalId !== undefined ||
      data.temaConectadoIds !== undefined ||
      data.conteudo !== undefined,
    {
      error: 'Informe ao menos um campo para atualizar a reflexão.',
    }
  )
  .refine(
    (data) => {
      if (data.temaPrincipalId && data.temaConectadoIds) {
        return !data.temaConectadoIds.includes(data.temaPrincipalId);
      }
      return true;
    },
    {
      path: ['temaConectadoIds'],
      error: 'O tema principal não pode estar na lista de temas conectados.',
    }
  );

export type CreateTemaInput = z.infer<typeof CreateTemaSchema>;
export type UpdateTemaInput = z.infer<typeof UpdateTemaSchema>;
export type TemasQueryInput = z.input<typeof TemasQuerySchema>;
export type TemasQuery = z.infer<typeof TemasQuerySchema>;
export type RegistrarPraticaInput = z.infer<typeof RegistrarPraticaSchema>;
export type CreateReflexaoFormInput = z.input<typeof CreateReflexaoSchema>;
export type CreateReflexaoInput = z.infer<typeof CreateReflexaoSchema>;
export type UpdateReflexaoInput = z.infer<typeof UpdateReflexaoSchema>;
