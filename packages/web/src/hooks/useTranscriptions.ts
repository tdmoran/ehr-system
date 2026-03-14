import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  transcriptionsApi,
  type TranscriptionListParams,
  type TranscriptionStatus,
} from '../api/transcriptions';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const transcriptionKeys = {
  all: ['transcriptions'] as const,
  sessions: (params: TranscriptionListParams) =>
    [...transcriptionKeys.all, 'sessions', params] as const,
  session: (id: string) =>
    [...transcriptionKeys.all, 'session', id] as const,
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TranscriptionFilters {
  status: TranscriptionStatus | '';
  patientSearch: string;
  startDate: string;
  endDate: string;
}

export interface TranscriptionSortConfig {
  sortBy: 'createdAt' | 'status' | 'durationSeconds';
  sortOrder: 'asc' | 'desc';
}

export interface TranscriptionPagination {
  page: number;
  limit: number;
  total: number;
}

const DEFAULT_FILTERS: TranscriptionFilters = {
  status: '',
  patientSearch: '',
  startDate: '',
  endDate: '',
};

const DEFAULT_SORT: TranscriptionSortConfig = {
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

const DEFAULT_PAGINATION: TranscriptionPagination = {
  page: 1,
  limit: 10,
  total: 0,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildParams(
  filters: TranscriptionFilters,
  sort: TranscriptionSortConfig,
  page: number,
  limit: number,
): TranscriptionListParams {
  const params: TranscriptionListParams = {
    page,
    limit,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
  };
  if (filters.status) params.status = filters.status;
  if (filters.patientSearch) params.patientSearch = filters.patientSearch;
  if (filters.startDate) params.startDate = filters.startDate;
  if (filters.endDate) params.endDate = filters.endDate;
  return params;
}

// ─── useTranscriptions ──────────────────────────────────────────────────────

export function useTranscriptions() {
  const [filters, setFilters] = useState<TranscriptionFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<TranscriptionSortConfig>(DEFAULT_SORT);
  const [pagination, setPagination] = useState<TranscriptionPagination>(DEFAULT_PAGINATION);

  // Debounced params for the query key so rapid filter changes don't fire multiple requests
  const [debouncedParams, setDebouncedParams] = useState<TranscriptionListParams>(() =>
    buildParams(DEFAULT_FILTERS, DEFAULT_SORT, 1, 10)
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const currentParams = useMemo(
    () => buildParams(filters, sort, pagination.page, pagination.limit),
    [filters, sort, pagination.page, pagination.limit],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedParams(currentParams);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [currentParams]);

  const query = useQuery({
    queryKey: transcriptionKeys.sessions(debouncedParams),
    queryFn: async () => {
      const { data, error } = await transcriptionsApi.getSessions(debouncedParams);
      if (error) throw new Error(error);
      return data!;
    },
  });

  // Sync server-side pagination total back to local state
  useEffect(() => {
    if (query.data) {
      setPagination((prev) => ({
        ...prev,
        total: query.data.total,
        page: query.data.page,
        limit: query.data.limit,
      }));
    }
  }, [query.data]);

  const updateFilters = useCallback((updates: Partial<TranscriptionFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const updateSort = useCallback((sortBy: TranscriptionSortConfig['sortBy']) => {
    setSort((prev) => ({
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  const goToPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSort(DEFAULT_SORT);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const refetch = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    sessions: query.data?.sessions ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    filters,
    sort,
    pagination,
    updateFilters,
    updateSort,
    goToPage,
    resetFilters,
    refetch,
  };
}

// ─── useTranscriptionSession ────────────────────────────────────────────────

export function useTranscriptionSession(id: string | null) {
  const query = useQuery({
    queryKey: transcriptionKeys.session(id ?? ''),
    queryFn: async () => {
      const { data, error } = await transcriptionsApi.getSession(id!);
      if (error) throw new Error(error);
      return data!;
    },
    enabled: id !== null,
  });

  const refetch = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    session: query.data?.session ?? null,
    note: query.data?.note ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch,
  };
}

// ─── useDeleteTranscription ─────────────────────────────────────────────────

export function useDeleteTranscription() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: apiError } = await transcriptionsApi.deleteSession(id);
      if (apiError) throw new Error(apiError);
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: transcriptionKeys.all });
    },
  });

  const deleteSession = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null);
      try {
        await mutation.mutateAsync(id);
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Delete failed';
        setError(message);
        return false;
      }
    },
    [mutation],
  );

  return {
    deleteSession,
    deleting: mutation.isPending,
    error,
  };
}
