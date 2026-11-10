import {
  CreateManualErrorSchema,
  UpdateCadernoErroSchema,
} from '@shared/schemas/caderno-erros.schema';
import { describe, expect, it } from 'vitest';
import {
  buildUpdateCadernoErroPayload,
  formatTempoDecorrido,
  isSafeHttpUrl,
} from '@/features/caderno-erros/utils/cadernoErros';

const TEMA_1 = '11111111-1111-4111-8111-111111111111';
const TEMA_2 = '22222222-2222-4222-8222-222222222222';

describe('cadernoErros utils', () => {
  describe('formatTempoDecorrido', () => {
    it('formata segundos menores que 1 hora em MM:SS', () => {
      expect(formatTempoDecorrido(0)).toBe('00:00');
      expect(formatTempoDecorrido(14)).toBe('00:14');
      expect(formatTempoDecorrido(1840)).toBe('30:40');
      expect(formatTempoDecorrido(3599)).toBe('59:59');
    });

    it('formata segundos >= 3600 em HH:MM:SS', () => {
      expect(formatTempoDecorrido(3600)).toBe('01:00:00');
      expect(formatTempoDecorrido(3665)).toBe('01:01:05');
      expect(formatTempoDecorrido(9910)).toBe('02:45:10');
    });

    it('retorna null para valores nulos ou negativos', () => {
      expect(formatTempoDecorrido(null)).toBeNull();
      expect(formatTempoDecorrido(-5)).toBeNull();
      expect(formatTempoDecorrido(Number.NaN)).toBeNull();
    });
  });

  describe('isSafeHttpUrl', () => {
    it('aceita apenas URLs com protocolo http ou https', () => {
      expect(
        isSafeHttpUrl('https://codeforces.com/problemset/problem/1900/C')
      ).toBe(true);
      expect(isSafeHttpUrl('http://localhost:3000/questao')).toBe(true);
      expect(isSafeHttpUrl('  https://prumo.app/prova  ')).toBe(true);
    });

    it('rejeita protocolos inseguros, strings vazias ou URLs malformadas', () => {
      expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(
        false
      );
      expect(isSafeHttpUrl('ftp://files.exemplo.com/a.pdf')).toBe(false);
      expect(isSafeHttpUrl('')).toBe(false);
      expect(isSafeHttpUrl('   ')).toBe(false);
      expect(isSafeHttpUrl(null)).toBe(false);
      expect(isSafeHttpUrl('nao-eh-url')).toBe(false);
    });
  });

  describe('buildUpdateCadernoErroPayload', () => {
    it('envia exclusivamente observacaoErro e temaIds para origem SIMULADO', () => {
      const payload = buildUpdateCadernoErroPayload({
        origem: 'SIMULADO',
        codigoReferencia: 'Q2',
        titulo: 'Título ignorado',
        enunciadoCompleto: 'Enunciado ignorado',
        linkExterno: 'https://ignorado.com',
        observacaoErro: '  Esqueci de modelar estado com k cupons.  ',
        temaIds: [TEMA_1, TEMA_1, TEMA_2],
      });

      expect(payload).toEqual({
        observacaoErro: 'Esqueci de modelar estado com k cupons.',
        temaIds: [TEMA_1, TEMA_2],
      });
      expect('titulo' in payload).toBe(false);
      expect('codigoReferencia' in payload).toBe(false);
      expect('enunciadoCompleto' in payload).toBe(false);
      expect('linkExterno' in payload).toBe(false);
      expect(UpdateCadernoErroSchema.safeParse(payload).success).toBe(true);
    });

    it('sanitiza payload para EXTERNAL_LINK usando fallback de titulo e omitindo enunciadoCompleto', () => {
      const payload = buildUpdateCadernoErroPayload({
        origem: 'EXTERNAL_LINK',
        codigoReferencia: '  CF 1900C  ',
        linkExterno: '  https://codeforces.com/problemset/problem/1900/C  ',
        titulo: '   ',
        enunciadoCompleto: 'Não deve ir no payload',
        observacaoErro: '   ',
        temaIds: [TEMA_1],
      });

      expect(payload).toEqual({
        codigoReferencia: 'CF 1900C',
        linkExterno: 'https://codeforces.com/problemset/problem/1900/C',
        titulo: 'CF 1900C',
        observacaoErro: null,
        temaIds: [TEMA_1],
      });
      expect('enunciadoCompleto' in payload).toBe(false);
      expect(UpdateCadernoErroSchema.safeParse(payload).success).toBe(true);
    });

    it('sanitiza payload para GENERIC_FULL normalizando linkExterno vazio para null e omitindo codigoReferencia', () => {
      const payload = buildUpdateCadernoErroPayload({
        origem: 'GENERIC_FULL',
        codigoReferencia: 'Não deve ir',
        titulo: '  Ponte de Wheatstone  ',
        enunciadoCompleto: '  Determine a resistência equivalente entre A e B.  ',
        linkExterno: '   ',
        observacaoErro: '  Esqueci o equilíbrio da ponte. ',
        temaIds: [TEMA_2],
      });

      expect(payload).toEqual({
        titulo: 'Ponte de Wheatstone',
        enunciadoCompleto: 'Determine a resistência equivalente entre A e B.',
        linkExterno: null,
        observacaoErro: 'Esqueci o equilíbrio da ponte.',
        temaIds: [TEMA_2],
      });
      expect('codigoReferencia' in payload).toBe(false);
      expect(UpdateCadernoErroSchema.safeParse(payload).success).toBe(true);
    });
  });

  describe('CreateManualErrorSchema guardrail', () => {
    it('rejeita origem SIMULADO no cadastro manual', () => {
      const parsed = CreateManualErrorSchema.safeParse({
        origem: 'SIMULADO',
        titulo: 'Tentativa inválida',
        temaIds: [TEMA_1],
      });

      expect(parsed.success).toBe(false);
    });
  });
});
