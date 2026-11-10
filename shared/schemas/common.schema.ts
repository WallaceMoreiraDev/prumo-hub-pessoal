import { z } from 'zod';

export const UuidSchema = z.uuid({
  error: 'Identificador UUID inválido.',
});

export const UuidParamSchema = z.object({
  id: UuidSchema,
});

export const PaginationQuerySchema = z.object({
  page: z.coerce
    .number({ error: 'O número da página deve ser numérico.' })
    .int({ error: 'O número da página deve ser inteiro.' })
    .min(1, { error: 'A página mínima é 1.' })
    .max(10000, { error: 'A página máxima permitida é 10000.' })
    .default(1),
  limit: z.coerce
    .number({ error: 'O limite por página deve ser numérico.' })
    .int({ error: 'O limite por página deve ser inteiro.' })
    .min(1, { error: 'O limite mínimo por página é 1.' })
    .max(100, { error: 'O limite máximo por página é 100.' })
    .default(20),
  search: z
    .string()
    .trim()
    .max(120, { error: 'A busca deve ter no máximo 120 caracteres.' })
    .optional(),
});

export const HttpUrlSchema = z
  .string({ error: 'Informe uma URL válida iniciada com http:// ou https://.' })
  .trim()
  .pipe(
    z
      .url({
        protocol: /^https?$/,
        error: 'Informe uma URL válida iniciada com http:// ou https://.',
      })
      .max(2048, { error: 'A URL deve ter no máximo 2048 caracteres.' })
  );

export type UuidParamInput = z.infer<typeof UuidParamSchema>;
export type PaginationQueryInput = z.input<typeof PaginationQuerySchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
