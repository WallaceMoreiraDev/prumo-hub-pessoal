import { zodResolver } from '@hookform/resolvers/zod';
import { CreateManualErrorSchema } from '@shared/schemas/caderno-erros.schema';
import { CreateTemaSchema } from '@shared/schemas/temas.schema';
import { ERROR_CODES } from '@shared/types/api.types';
import { describe, expect, it } from 'vitest';
import {
  ApiClientError,
  ERROR_MESSAGES,
  getErrorMessage,
} from '@/lib/errorMessages';

describe('contratos @shared e dicionário de erros', () => {
  it('cobre 100% dos ERROR_CODES no dicionário ERROR_MESSAGES', () => {
    for (const code of Object.values(ERROR_CODES)) {
      const message = ERROR_MESSAGES[code];
      expect(typeof message).toBe('string');
      expect(message.trim().length).toBeGreaterThan(0);
    }
  });

  it('traduz ApiClientError para mensagem em Português preservando detalhes de validação', () => {
    const notFound = new ApiClientError({
      statusCode: 404,
      code: ERROR_CODES.TEMA_NOT_FOUND,
    });
    expect(getErrorMessage(notFound)).toBe(ERROR_MESSAGES.TEMA_NOT_FOUND);

    const validation = new ApiClientError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      details: [
        {
          path: 'nome',
          message: 'O nome do tema não pode conter o caractere "#".',
        },
      ],
    });
    expect(getErrorMessage(validation)).toBe(
      'O nome do tema não pode conter o caractere "#".'
    );
  });

  it('integra schemas Zod v4 de @shared com zodResolver sem conflito de instância', async () => {
    const temaResolver = zodResolver(CreateTemaSchema);
    const validTema = await temaResolver(
      { nome: 'Dijkstra' },
      undefined,
      { fields: {}, shouldUseNativeValidation: false }
    );
    expect(validTema.errors).toEqual({});
    expect(validTema.values).toEqual({ nome: 'Dijkstra' });

    const invalidTema = await temaResolver(
      { nome: '#Dijkstra' },
      undefined,
      { fields: {}, shouldUseNativeValidation: false }
    );
    expect(invalidTema.errors.nome?.message).toBe(
      'O nome do tema não pode conter o caractere "#".'
    );

    const errorResolver = zodResolver(CreateManualErrorSchema);
    const validExternal = await errorResolver(
      {
        origem: 'EXTERNAL_LINK',
        codigoReferencia: '222A',
        linkExterno: 'https://codeforces.com/problemset/problem/222/A',
        titulo: '',
        temaIds: ['550e8400-e29b-41d4-a716-446655440001'],
      },
      undefined,
      { fields: {}, shouldUseNativeValidation: false }
    );
    expect(validExternal.errors).toEqual({});
  });
});
