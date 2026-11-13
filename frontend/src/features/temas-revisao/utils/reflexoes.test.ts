import type { ReflexaoDto, TemaSummaryDto } from '@shared/types/temas.types';
import { describe, expect, it } from 'vitest';
import { getConnectedPeerThemes } from '@/features/temas-revisao/utils/reflexoes';

const TEMA_DIJKSTRA: TemaSummaryDto = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Dijkstra',
  lastReviewedAt: null,
  lastReviewMode: null,
};

const TEMA_BFS: TemaSummaryDto = {
  id: '22222222-2222-4222-8222-222222222222',
  nome: 'BFS',
  lastReviewedAt: null,
  lastReviewMode: null,
};

const TEMA_ZERO_ONE_BFS: TemaSummaryDto = {
  id: '33333333-3333-4333-8333-333333333333',
  nome: '0-1 BFS',
  lastReviewedAt: null,
  lastReviewMode: null,
};

const CONEXAO_FIXTURE: ReflexaoDto = {
  id: '44444444-4444-4444-8444-444444444444',
  userId: '55555555-5555-4555-8555-555555555555',
  temaPrincipalId: TEMA_DIJKSTRA.id,
  temaPrincipal: TEMA_DIJKSTRA,
  temasConectados: [TEMA_BFS, TEMA_ZERO_ONE_BFS],
  conteudo: 'Comparação de pesos uniformes vs pesos não-negativos.',
  lousaId: null,
  lousa: null,
  createdAt: '2026-11-10T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z',
};

describe('reflexoes utils (conexões bidirecionais)', () => {
  it('retorna os temasConectados quando exibida na gaveta do temaPrincipal', () => {
    const peers = getConnectedPeerThemes(CONEXAO_FIXTURE, TEMA_DIJKSTRA.id);
    expect(peers.map((item) => item.nome)).toEqual(['BFS', '0-1 BFS']);
  });

  it('destaca o temaPrincipal e demais pares sem incluir o tema atual na gaveta conectada', () => {
    const peers = getConnectedPeerThemes(CONEXAO_FIXTURE, TEMA_BFS.id);
    expect(peers.map((item) => item.nome)).toEqual(['Dijkstra', '0-1 BFS']);
  });

  it('deduplica eventuais temas repetidos na listagem de pares', () => {
    const duplicated: ReflexaoDto = {
      ...CONEXAO_FIXTURE,
      temasConectados: [TEMA_BFS, TEMA_BFS],
    };

    const peers = getConnectedPeerThemes(duplicated, TEMA_DIJKSTRA.id);
    expect(peers).toHaveLength(1);
    expect(peers[0]?.id).toBe(TEMA_BFS.id);
  });
});
