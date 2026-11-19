import { z } from 'zod';
import { REVIEW_MODES } from '../types/enums.types';
import {
  HttpUrlSchema,
  PaginationQuerySchema,
  UuidSchema,
} from './common.schema';

export const CreateExercicioAvulsoSchema = z.object({
  titulo: z
    .string({ error: 'O título do exercício é obrigatório.' })
    .trim()
    .min(1, { error: 'O título não pode ser vazio.' })
    .max(160, { error: 'O título deve ter no máximo 160 caracteres.' }),
  enunciado: z
    .string()
    .trim()
    .max(10000, { error: 'O enunciado deve ter no máximo 10.000 caracteres.' })
    .nullable()
    .optional()
    .transform((val) => (val === '' || val === undefined ? null : val)),
  linkExterno: z
    .union([HttpUrlSchema, z.literal('')])
    .nullable()
    .optional()
    .transform((val) => (val === '' || val === undefined ? null : val)),
  observacao: z
    .string()
    .trim()
    .max(10000, { error: 'A observação deve ter no máximo 10.000 caracteres.' })
    .nullable()
    .optional()
    .transform((val) => (val === '' || val === undefined ? null : val)),
  duracaoSegundos: z.coerce
    .number({ error: 'A duração deve ser numérica.' })
    .int({ error: 'A duração deve ser inteira.' })
    .min(0, { error: 'A duração não pode ser negativa.' })
    .default(0),
  desfecho: z.enum(REVIEW_MODES).nullable().optional(),
  lousaId: UuidSchema.nullable().optional(),
  temaIds: z
    .array(UuidSchema, { error: 'Selecione pelo menos um tema.' })
    .min(1, { error: 'Selecione pelo menos um tema para o exercício.' })
    .transform((ids) => [...new Set(ids)]),
});

export const UpdateExercicioAvulsoSchema = z
  .object({
    titulo: z
      .string()
      .trim()
      .min(1, { error: 'O título não pode ser vazio.' })
      .max(160, { error: 'O título deve ter no máximo 160 caracteres.' })
      .optional(),
    enunciado: z
      .string()
      .trim()
      .max(10000, { error: 'O enunciado deve ter no máximo 10.000 caracteres.' })
      .nullable()
      .optional()
      .transform((val) => (val === '' ? null : val)),
    linkExterno: z
      .union([HttpUrlSchema, z.literal('')])
      .nullable()
      .optional()
      .transform((val) => (val === '' ? null : val)),
    observacao: z
      .string()
      .trim()
      .max(10000, { error: 'A observação deve ter no máximo 10.000 caracteres.' })
      .nullable()
      .optional()
      .transform((val) => (val === '' ? null : val)),
    duracaoSegundos: z.coerce
      .number()
      .int()
      .min(0, { error: 'A duração não pode ser negativa.' })
      .optional(),
    desfecho: z.enum(REVIEW_MODES).nullable().optional(),
    lousaId: UuidSchema.nullable().optional(),
    temaIds: z
      .array(UuidSchema)
      .min(1, { error: 'Selecione pelo menos um tema.' })
      .transform((ids) => [...new Set(ids)])
      .optional(),
  })
  .refine(
    (data) =>
      data.titulo !== undefined ||
      data.enunciado !== undefined ||
      data.linkExterno !== undefined ||
      data.observacao !== undefined ||
      data.duracaoSegundos !== undefined ||
      data.desfecho !== undefined ||
      data.lousaId !== undefined ||
      data.temaIds !== undefined,
    {
      error: 'Informe ao menos um campo para atualizar o exercício.',
    }
  );

export const ListExerciciosQuerySchema = PaginationQuerySchema.extend({
  temaId: UuidSchema.optional(),
  desfecho: z.enum(REVIEW_MODES).optional(),
});

export const EstudosResumoQuerySchema = z
  .object({
    periodo: z.enum(['dia', 'semana', 'custom']).default('dia'),
    data: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, {
        error: 'A data deve estar no formato YYYY-MM-DD.',
      })
      .optional(),
    dataInicio: z.string().datetime({ error: 'Data de início inválida.' }).optional(),
    dataFim: z.string().datetime({ error: 'Data de término inválida.' }).optional(),
  })
  .refine(
    (data) => {
      if (data.periodo === 'custom') {
        return Boolean(data.dataInicio && data.dataFim);
      }
      return true;
    },
    {
      path: ['dataInicio'],
      error: 'Informe dataInicio e dataFim válidas para o período custom.',
    }
  );

export type CreateExercicioAvulsoInput = z.infer<typeof CreateExercicioAvulsoSchema>;
export type UpdateExercicioAvulsoInput = z.infer<typeof UpdateExercicioAvulsoSchema>;
export type ListExerciciosQuery = z.infer<typeof ListExerciciosQuerySchema>;
export type EstudosResumoQuery = z.infer<typeof EstudosResumoQuerySchema>;
