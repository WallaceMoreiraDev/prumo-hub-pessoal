import { z } from 'zod';
import { ERRO_ORIGENS, ERRO_STATUSES, REVIEW_MODES } from '../types/enums.types';
import { HttpUrlSchema, PaginationQuerySchema, UuidSchema } from './common.schema';

export const ExternalLinkManualErrorSchema = z.object({
  origem: z.literal('EXTERNAL_LINK'),
  codigoReferencia: z
    .string({ error: 'O código/referência da questão é obrigatório.' })
    .trim()
    .min(1, { error: 'O código/referência da questão não pode estar vazio.' })
    .max(60, { error: 'O código/referência deve ter no máximo 60 caracteres.' }),
  linkExterno: HttpUrlSchema,
  titulo: z
    .string()
    .trim()
    .max(200, { error: 'O título deve ter no máximo 200 caracteres.' })
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  temaIds: z
    .array(UuidSchema, { error: 'Informe os temas da questão.' })
    .min(1, { error: 'Selecione pelo menos um tema.' })
    .max(30, { error: 'Selecione no máximo 30 temas.' }),
  observacaoErro: z
    .string()
    .trim()
    .max(5000, { error: 'A observação deve ter no máximo 5000 caracteres.' })
    .nullable()
    .optional(),
});

export const GenericFullManualErrorSchema = z.object({
  origem: z.literal('GENERIC_FULL'),
  titulo: z
    .string({ error: 'O título da questão é obrigatório.' })
    .trim()
    .min(1, { error: 'O título da questão não pode estar vazio.' })
    .max(200, { error: 'O título deve ter no máximo 200 caracteres.' }),
  enunciadoCompleto: z
    .string({ error: 'O enunciado completo da questão é obrigatório.' })
    .trim()
    .min(1, { error: 'O enunciado completo não pode estar vazio.' })
    .max(15000, { error: 'O enunciado deve ter no máximo 15000 caracteres.' }),
  linkExterno: z
    .union([HttpUrlSchema, z.literal('')])
    .nullable()
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value)),
  temaIds: z
    .array(UuidSchema, { error: 'Informe os temas da questão.' })
    .min(1, { error: 'Selecione pelo menos um tema.' })
    .max(30, { error: 'Selecione no máximo 30 temas.' }),
  observacaoErro: z
    .string()
    .trim()
    .max(5000, { error: 'A observação deve ter no máximo 5000 caracteres.' })
    .nullable()
    .optional(),
});

export const CreateManualErrorSchema = z.discriminatedUnion(
  'origem',
  [ExternalLinkManualErrorSchema, GenericFullManualErrorSchema],
  {
    error:
      'Origem inválida para cadastro manual. Utilize EXTERNAL_LINK ou GENERIC_FULL.',
  }
);

export const UpdateCadernoErroSchema = z
  .object({
    codigoReferencia: z
      .string()
      .trim()
      .min(1, { error: 'O código/referência não pode estar vazio.' })
      .max(60, { error: 'O código/referência deve ter no máximo 60 caracteres.' })
      .nullable()
      .optional(),
    titulo: z
      .string()
      .trim()
      .min(1, { error: 'O título não pode estar vazio.' })
      .max(200, { error: 'O título deve ter no máximo 200 caracteres.' })
      .optional(),
    enunciadoCompleto: z
      .string()
      .trim()
      .min(1, { error: 'O enunciado não pode estar vazio.' })
      .max(15000, { error: 'O enunciado deve ter no máximo 15000 caracteres.' })
      .nullable()
      .optional(),
    linkExterno: z
      .union([HttpUrlSchema, z.literal('')])
      .nullable()
      .optional()
      .transform((value) => (value === '' ? null : value)),
    observacaoErro: z
      .string()
      .trim()
      .max(5000, { error: 'A observação deve ter no máximo 5000 caracteres.' })
      .nullable()
      .optional(),
    temaIds: z
      .array(UuidSchema)
      .min(1, { error: 'Selecione pelo menos um tema.' })
      .max(30, { error: 'Selecione no máximo 30 temas.' })
      .optional(),
  })
  .refine(
    (data) =>
      data.codigoReferencia !== undefined ||
      data.titulo !== undefined ||
      data.enunciadoCompleto !== undefined ||
      data.linkExterno !== undefined ||
      data.observacaoErro !== undefined ||
      data.temaIds !== undefined,
    {
      error: 'Informe ao menos um campo para atualizar o registro do caderno de erros.',
    }
  );

export const CadernoErrosQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(ERRO_STATUSES).optional(),
  temaId: UuidSchema.optional(),
  origem: z.enum(ERRO_ORIGENS).optional(),
});

export const RevisarCadernoErroSchema = z.object({
  reviewMode: z.enum(REVIEW_MODES, {
    error: 'Modo de revisão inválido. Utilize SOLO ou HELP.',
  }),
});

export type CreateManualErrorFormInput = z.input<typeof CreateManualErrorSchema>;
export type CreateManualErrorInput = z.infer<typeof CreateManualErrorSchema>;
export type UpdateCadernoErroFormInput = z.input<typeof UpdateCadernoErroSchema>;
export type UpdateCadernoErroInput = z.infer<typeof UpdateCadernoErroSchema>;
export type CadernoErrosQuery = z.infer<typeof CadernoErrosQuerySchema>;
export type RevisarCadernoErroInput = z.infer<typeof RevisarCadernoErroSchema>;
