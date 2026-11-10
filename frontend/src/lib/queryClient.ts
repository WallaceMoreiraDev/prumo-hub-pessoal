import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@/lib/errorMessages';

const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404, 409, 413, 422, 429]);

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (
    error instanceof ApiClientError &&
    NON_RETRYABLE_STATUS_CODES.has(error.statusCode)
  ) {
    return false;
  }

  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: shouldRetryQuery,
    },
    mutations: {
      retry: false,
    },
  },
});
