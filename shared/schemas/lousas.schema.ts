import { z } from 'zod';
import { LOUSA_PREVIEW_MIME_TYPES } from '../types/lousas.types';
import { UuidSchema } from './common.schema';

export const LousaPreviewMimeSchema = z.enum(LOUSA_PREVIEW_MIME_TYPES, {
  error: 'Formato de pré-visualização inválido. Utilize WebP ou PNG.',
});

export const LousaParamSchema = z.object({
  id: UuidSchema,
});

export const LousaSceneSchema = z
  .looseObject({
    type: z.literal('excalidraw').optional(),
    elements: z.array(z.unknown(), {
      error: 'A cena da lousa deve conter uma lista válida de elementos.',
    }),
  });

export type LousaParamInput = z.infer<typeof LousaParamSchema>;
export type LousaScenePayload = z.infer<typeof LousaSceneSchema>;
