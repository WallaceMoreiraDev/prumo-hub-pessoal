/**
 * Garante que uma URL utilize estritamente os protocolos `http:` ou `https:`
 * antes de ser renderizada como link clicável na interface.
 */
export function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
