import type { ReflexaoDto, TemaSummaryDto } from '@shared/types/temas.types';

/**
 * Extrai, sem duplicação e de forma bidirecional, os demais temas ligados
 * a uma conexão quando exibida dentro da gaveta de `currentTemaId`.
 *
 * - Se o tema atual é o `temaPrincipal`, retorna os `temasConectados`.
 * - Se o tema atual é um dos `temasConectados`, destaca primeiro o `temaPrincipal`
 *   seguido por quaisquer outros `temasConectados` diferentes do tema atual.
 */
export function getConnectedPeerThemes(
  reflexao: ReflexaoDto,
  currentTemaId: string
): TemaSummaryDto[] {
  const seen = new Set<string>([currentTemaId]);
  const peers: TemaSummaryDto[] = [];

  if (reflexao.temaPrincipalId !== currentTemaId) {
    seen.add(reflexao.temaPrincipal.id);
    peers.push(reflexao.temaPrincipal);
  }

  for (const connected of reflexao.temasConectados) {
    if (!seen.has(connected.id)) {
      seen.add(connected.id);
      peers.push(connected);
    }
  }

  return peers;
}

export function toTemaSummary(tema: {
  id: string;
  nome: string;
  lastReviewedAt: string | null;
  lastReviewMode: TemaSummaryDto['lastReviewMode'];
}): TemaSummaryDto {
  return {
    id: tema.id,
    nome: tema.nome,
    lastReviewedAt: tema.lastReviewedAt,
    lastReviewMode: tema.lastReviewMode,
  };
}
