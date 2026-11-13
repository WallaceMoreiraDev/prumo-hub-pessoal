import { CreateReflexaoSchema } from '@shared/schemas/temas.schema';
import { ERROR_CODES } from '@shared/types/api.types';
import { LOUSA_MAX_TOTAL_SIZE_BYTES } from '@shared/types/lousas.types';
import { describe, expect, it } from 'vitest';
import {
  calculateLousaTotalBytes,
  evaluateLousaBudget,
  formatBytesLabel,
  isWithinLousaBudget,
  measureUtf8ByteLength,
  parseValidatedLousaScene,
} from '@/features/lousas/utils/lousaBudget';
import { ERROR_MESSAGES } from '@/lib/errorMessages';

const TEMA_ID = '11111111-1111-4111-8111-111111111111';
const LOUSA_ID = '22222222-2222-4222-8222-222222222222';

describe('lousaBudget utils & contratos compartilhados', () => {
  it('mede corretamente o tamanho UTF-8 incluindo caracteres multibyte', () => {
    const ascii = 'abc';
    const multibyte = 'áéíóú';
    expect(measureUtf8ByteLength(ascii)).toBe(3);
    expect(measureUtf8ByteLength(multibyte)).toBe(10);
  });

  it('aceita exatamente até 3 MiB e rejeita qualquer excesso acima do teto', () => {
    const halfBytes = Math.floor(LOUSA_MAX_TOTAL_SIZE_BYTES / 2);
    const exactScene = 'a'.repeat(halfBytes);
    const exactPreview = LOUSA_MAX_TOTAL_SIZE_BYTES - halfBytes;

    const exactEval = evaluateLousaBudget(exactScene, exactPreview);
    expect(exactEval.totalBytes).toBe(LOUSA_MAX_TOTAL_SIZE_BYTES);
    expect(exactEval.isWithinLimit).toBe(true);
    expect(isWithinLousaBudget(exactEval.totalBytes)).toBe(true);

    const overTotal = calculateLousaTotalBytes(exactScene, exactPreview + 1);
    expect(overTotal).toBe(LOUSA_MAX_TOTAL_SIZE_BYTES + 1);
    expect(isWithinLousaBudget(overTotal)).toBe(false);
    expect(isWithinLousaBudget(0)).toBe(false);
  });

  it('formata bytes em B, KiB e MiB no padrão pt-BR', () => {
    expect(formatBytesLabel(512)).toBe('512 B');
    expect(formatBytesLabel(1536)).toBe('1,5 KiB');
    expect(formatBytesLabel(LOUSA_MAX_TOTAL_SIZE_BYTES)).toBe('3,00 MiB');
  });

  it('valida cena Excalidraw com LousaSceneSchema e rejeita payload inválido', () => {
    const parsed = parseValidatedLousaScene({
      type: 'excalidraw',
      elements: [{ id: 'el-1', type: 'rectangle' }],
      appState: { viewBackgroundColor: '#ffffff' },
    });

    expect(parsed.type).toBe('excalidraw');
    expect(parsed.elements).toHaveLength(1);
    expect(parsed.appState).toEqual({ viewBackgroundColor: '#ffffff' });

    expect(() =>
      parseValidatedLousaScene({ type: 'outro', elements: 'invalido' })
    ).toThrow();
  });

  it('CreateReflexaoSchema aceita reflexão apenas com lousaId (conteudo null) e rejeita ambos vazios', () => {
    const onlyLousa = CreateReflexaoSchema.safeParse({
      temaPrincipalId: TEMA_ID,
      temaConectadoIds: [],
      conteudo: null,
      lousaId: LOUSA_ID,
    });
    expect(onlyLousa.success).toBe(true);

    const blankTextWithLousa = CreateReflexaoSchema.safeParse({
      temaPrincipalId: TEMA_ID,
      temaConectadoIds: [],
      conteudo: '   ',
      lousaId: LOUSA_ID,
    });
    expect(blankTextWithLousa.success).toBe(true);
    if (blankTextWithLousa.success) {
      expect(blankTextWithLousa.data.conteudo).toBeNull();
    }

    const bothEmpty = CreateReflexaoSchema.safeParse({
      temaPrincipalId: TEMA_ID,
      temaConectadoIds: [],
      conteudo: '   ',
      lousaId: null,
    });
    expect(bothEmpty.success).toBe(false);
  });

  it('ERROR_MESSAGES traduz todos os 5 novos códigos de lousa e explicita 3 MiB em LOUSA_TOO_LARGE', () => {
    expect(ERROR_MESSAGES[ERROR_CODES.LOUSA_NOT_FOUND]).toBeTruthy();
    expect(ERROR_MESSAGES[ERROR_CODES.LOUSA_TOO_LARGE]).toContain('3 MiB');
    expect(ERROR_MESSAGES[ERROR_CODES.LOUSA_INVALID_PAYLOAD]).toBeTruthy();
    expect(ERROR_MESSAGES[ERROR_CODES.LOUSA_ALREADY_IN_USE]).toBeTruthy();
    expect(ERROR_MESSAGES[ERROR_CODES.LOUSA_IN_USE]).toBeTruthy();
  });
});
