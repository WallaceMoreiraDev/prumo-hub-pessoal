import { z } from 'zod';
import { QUESTAO_RESULTADOS, SIMULADO_STATUSES } from '../types/enums.types';
import { PaginationQuerySchema, UuidSchema } from './common.schema';

export const CreateSimuladoSchema = z.object({
  titulo: z
    .string({ error: 'O título do simulado é obrigatório.' })
    .trim()
    .min(1, { error: 'O título do simulado não pode estar vazio.' })
    .max(160, { error: 'O título do simulado deve ter no máximo 160 caracteres.' }),
  duracaoConfiguradaSegundos: z
    .number({ error: 'A duração do simulado deve ser um número inteiro.' })
    .int({ error: 'A duração do simulado deve ser um número inteiro de segundos.' })
    .min(1, { error: 'A duração do simulado deve ser maior que zero.' })
    .max(86400, { error: 'A duração máxima permitida é de 24 horas (86400 segundos).' }),
});

export const UpdateSimuladoSchema = z
  .object({
    titulo: z
      .string()
      .trim()
      .min(1, { error: 'O título do simulado não pode estar vazio.' })
      .max(160, { error: 'O título do simulado deve ter no máximo 160 caracteres.' })
      .optional(),
    duracaoConfiguradaSegundos: z
      .number({ error: 'A duração do simulado deve ser um número inteiro.' })
      .int({ error: 'A duração do simulado deve ser um número inteiro de segundos.' })
      .min(1, { error: 'A duração do simulado deve ser maior que zero.' })
      .max(86400, { error: 'A duração máxima permitida é de 24 horas (86400 segundos).' })
      .optional(),
  })
  .refine(
    (data) =>
      data.titulo !== undefined || data.duracaoConfiguradaSegundos !== undefined,
    {
      error: 'Informe ao menos um campo para atualizar o simulado.',
    }
  );

export const SimuladosQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(SIMULADO_STATUSES).optional(),
});

export const CreateSimuladoQuestaoSchema = z.object({
  numeroQuestao: z
    .string({ error: 'O número/código da questão é obrigatório.' })
    .trim()
    .min(1, { error: 'O número/código da questão não pode estar vazio.' })
    .max(30, { error: 'O número/código da questão deve ter no máximo 30 caracteres.' }),
  tituloQuestao: z
    .string({ error: 'O título da questão é obrigatório.' })
    .trim()
    .min(1, { error: 'O título da questão não pode estar vazio.' })
    .max(200, { error: 'O título da questão deve ter no máximo 200 caracteres.' }),
  ordem: z
    .number({ error: 'A ordem deve ser um número inteiro.' })
    .int({ error: 'A ordem deve ser um número inteiro.' })
    .min(0, { error: 'A ordem não pode ser negativa.' })
    .max(10000, { error: 'A ordem máxima permitida é 10000.' })
    .optional(),
});

export const UpdateSimuladoQuestaoSchema = z
  .object({
    numeroQuestao: z
      .string()
      .trim()
      .min(1, { error: 'O número/código da questão não pode estar vazio.' })
      .max(30, { error: 'O número/código da questão deve ter no máximo 30 caracteres.' })
      .optional(),
    tituloQuestao: z
      .string()
      .trim()
      .min(1, { error: 'O título da questão não pode estar vazio.' })
      .max(200, { error: 'O título da questão deve ter no máximo 200 caracteres.' })
      .optional(),
    ordem: z
      .number({ error: 'A ordem deve ser um número inteiro.' })
      .int({ error: 'A ordem deve ser um número inteiro.' })
      .min(0, { error: 'A ordem não pode ser negativa.' })
      .max(10000, { error: 'A ordem máxima permitida é 10000.' })
      .optional(),
  })
  .refine(
    (data) =>
      data.numeroQuestao !== undefined ||
      data.tituloQuestao !== undefined ||
      data.ordem !== undefined,
    {
      error: 'Informe ao menos um campo para atualizar a questão.',
    }
  );

export const CreateSimuladoPensamentoSchema = z.object({
  simuladoQuestaoId: UuidSchema,
  descricao: z
    .string({ error: 'A descrição do pensamento é obrigatória.' })
    .trim()
    .min(1, { error: 'A descrição do pensamento não pode estar vazia.' })
    .max(4000, { error: 'A descrição do pensamento deve ter no máximo 4000 caracteres.' }),
  tempoDecorridoSegundos: z
    .number({ error: 'O tempo decorrido deve ser um número inteiro.' })
    .int({ error: 'O tempo decorrido deve ser um número inteiro de segundos.' })
    .min(0, { error: 'O tempo decorrido não pode ser negativo.' })
    .max(864000, { error: 'O tempo decorrido excede o limite permitido.' })
    .nullable()
    .optional(),
});

export const UpdateSimuladoPensamentoSchema = z
  .object({
    simuladoQuestaoId: UuidSchema.optional(),
    descricao: z
      .string()
      .trim()
      .min(1, { error: 'A descrição do pensamento não pode estar vazia.' })
      .max(4000, { error: 'A descrição do pensamento deve ter no máximo 4000 caracteres.' })
      .optional(),
    tempoDecorridoSegundos: z
      .number({ error: 'O tempo decorrido deve ser um número inteiro.' })
      .int({ error: 'O tempo decorrido deve ser um número inteiro de segundos.' })
      .min(0, { error: 'O tempo decorrido não pode ser negativo.' })
      .max(864000, { error: 'O tempo decorrido excede o limite permitido.' })
      .nullable()
      .optional(),
  })
  .refine(
    (data) =>
      data.simuladoQuestaoId !== undefined ||
      data.descricao !== undefined ||
      data.tempoDecorridoSegundos !== undefined,
    {
      error: 'Informe ao menos um campo para atualizar o pensamento.',
    }
  );

export const FinalizarSimuladoSchema = z.object({
  tempoGastoSegundos: z
    .number({ error: 'O tempo gasto deve ser um número inteiro.' })
    .int({ error: 'O tempo gasto deve ser um número inteiro de segundos.' })
    .min(0, { error: 'O tempo gasto não pode ser negativo.' })
    .max(864000, { error: 'O tempo gasto excede o limite permitido.' }),
});

export const ClassificarQuestaoSimuladoSchema = z
  .object({
    resultado: z.enum(QUESTAO_RESULTADOS, {
      error: 'Resultado inválido. Utilize ACERTEI, PARCIAL ou ERREI.',
    }),
    temaIds: z
      .array(UuidSchema)
      .max(30, { error: 'Selecione no máximo 30 temas por questão.' })
      .default([]),
    observacaoPosRevisao: z
      .string()
      .trim()
      .max(5000, { error: 'A observação pós-revisão deve ter no máximo 5000 caracteres.' })
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.resultado === 'ACERTEI' &&
      data.observacaoPosRevisao !== undefined &&
      data.observacaoPosRevisao !== null &&
      data.observacaoPosRevisao.length > 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['observacaoPosRevisao'],
        message:
          'A observação de pós-revisão não é permitida quando o resultado é ACERTEI.',
      });
    }
  })
  .transform((data) => ({
    ...data,
    observacaoPosRevisao:
      data.resultado === 'ACERTEI' || !data.observacaoPosRevisao
        ? null
        : data.observacaoPosRevisao,
  }));

export type CreateSimuladoInput = z.infer<typeof CreateSimuladoSchema>;
export type UpdateSimuladoInput = z.infer<typeof UpdateSimuladoSchema>;
export type SimuladosQuery = z.infer<typeof SimuladosQuerySchema>;
export type CreateSimuladoQuestaoInput = z.infer<typeof CreateSimuladoQuestaoSchema>;
export type UpdateSimuladoQuestaoInput = z.infer<typeof UpdateSimuladoQuestaoSchema>;
export type CreateSimuladoPensamentoInput = z.infer<typeof CreateSimuladoPensamentoSchema>;
export type UpdateSimuladoPensamentoInput = z.infer<typeof UpdateSimuladoPensamentoSchema>;
export type FinalizarSimuladoInput = z.infer<typeof FinalizarSimuladoSchema>;
export type ClassificarQuestaoSimuladoFormInput = z.input<
  typeof ClassificarQuestaoSimuladoSchema
>;
export type ClassificarQuestaoSimuladoInput = z.infer<
  typeof ClassificarQuestaoSimuladoSchema
>;
