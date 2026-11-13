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

const NullableReflexaoConteudoInput = z
  .string()
  .max(5000, { error: 'O conteúdo deve ter no máximo 5000 caracteres.' })
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined || val === null) {
      return null;
    }
    const trimmed = val.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const OptionalNullableReflexaoConteudoInput = z
  .string()
  .max(5000, { error: 'O conteúdo deve ter no máximo 5000 caracteres.' })
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined) {
      return undefined;
    }
    if (val === null) {
      return null;
    }
    const trimmed = val.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

export const CreateReflexaoSchema = z
  .object({
    temaPrincipalId: UuidSchema,
    temaConectadoIds: z
      .array(UuidSchema)
      .max(30, { error: 'Selecione no máximo 30 temas conectados.' })
      .optional()
      .default([]),
    conteudo: NullableReflexaoConteudoInput,
    lousaId: UuidSchema.nullable().optional().default(null),
  })
  .superRefine((data, ctx) => {
    if (data.temaConectadoIds.includes(data.temaPrincipalId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['temaConectadoIds'],
        message: 'O tema principal não pode estar na lista de temas conectados.',
      });
    }

    if (data.conteudo === null && data.lousaId === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['conteudo'],
        message: 'Informe um texto de reflexão ou anexe uma lousa.',
      });
    }
  });

export const UpdateReflexaoSchema = z
  .object({
    temaPrincipalId: UuidSchema.optional(),
    temaConectadoIds: z
      .array(UuidSchema)
      .max(30, { error: 'Selecione no máximo 30 temas conectados.' })
      .optional(),
    conteudo: OptionalNullableReflexaoConteudoInput,
    lousaId: UuidSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.temaPrincipalId === undefined &&
      data.temaConectadoIds === undefined &&
      data.conteudo === undefined &&
      data.lousaId === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe ao menos um campo para atualizar a reflexão.',
      });
    }

    if (
      data.temaPrincipalId &&
      data.temaConectadoIds &&
      data.temaConectadoIds.includes(data.temaPrincipalId)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['temaConectadoIds'],
        message: 'O tema principal não pode estar na lista de temas conectados.',
      });
    }

    if (data.conteudo === null && data.lousaId === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['conteudo'],
        message: 'A reflexão deve manter ao menos um conteúdo em texto ou uma lousa.',
      });
    }
  });

export type CreateTemaInput = z.infer<typeof CreateTemaSchema>;
export type UpdateTemaInput = z.infer<typeof UpdateTemaSchema>;
export type TemasQueryInput = z.input<typeof TemasQuerySchema>;
export type TemasQuery = z.infer<typeof TemasQuerySchema>;
export type RegistrarPraticaInput = z.infer<typeof RegistrarPraticaSchema>;
export type CreateReflexaoFormInput = z.input<typeof CreateReflexaoSchema>;
export type CreateReflexaoInput = z.infer<typeof CreateReflexaoSchema>;
export type UpdateReflexaoInput = z.infer<typeof UpdateReflexaoSchema>;
