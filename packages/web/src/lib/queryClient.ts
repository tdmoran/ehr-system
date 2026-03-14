import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s before data considered stale
      gcTime: 5 * 60_000,       // 5min garbage collection
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
