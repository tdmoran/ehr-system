import { useState, useEffect, useCallback, useRef } from 'react';
import {
  transcriptionsApi,
  TranscriptionSession,
  TranscriptionNote,
  TranscriptionListParams,
  TranscriptionStatus,
} from '../api/transcriptions';

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

export function useTranscriptions() {
  const [sessions, setSessions] = useState<TranscriptionSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TranscriptionFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<TranscriptionSortConfig>(DEFAULT_SORT);
  const [pagination, setPagination] = useState<TranscriptionPagination>(DEFAULT_PAGINATION);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchSessions = useCallback(async (
    currentFilters: TranscriptionFilters,
    currentSort: TranscriptionSortConfig,
    currentPage: number,
    currentLimit: number
  ) => {
    setLoading(true);
    setError(null);

    const params: TranscriptionListParams = {
      page: currentPage,
      limit: currentLimit,
      sortBy: currentSort.sortBy,
      sortOrder: currentSort.sortOrder,
    };

    if (currentFilters.status) {
      params.status = currentFilters.status;
    }
    if (currentFilters.patientSearch) {
      params.patientSearch = currentFilters.patientSearch;
    }
    if (currentFilters.startDate) {
      params.startDate = currentFilters.startDate;
    }
    if (currentFilters.endDate) {
      params.endDate = currentFilters.endDate;
    }

    const { data, error: apiError } = await transcriptionsApi.getSessions(params);

    if (apiError) {
      setError(apiError);
    } else if (data) {
      setSessions(data.sessions);
      setPagination((prev) => ({
        ...prev,
        total: data.total,
        page: data.page,
        limit: data.limit,
      }));
    }

    setLoading(false);
  }, []);

  // Debounced fetch on filter/sort/page changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSessions(filters, sort, pagination.page, pagination.limit);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [filters, sort, pagination.page, pagination.limit, fetchSessions]);

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
    fetchSessions(filters, sort, pagination.page, pagination.limit);
  }, [filters, sort, pagination.page, pagination.limit, fetchSessions]);

  return {
    sessions,
    loading,
    error,
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

export function useTranscriptionSession(id: string | null) {
  const [session, setSession] = useState<TranscriptionSession | null>(null);
  const [note, setNote] = useState<TranscriptionNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    const { data, error: apiError } = await transcriptionsApi.getSession(id);

    if (apiError) {
      setError(apiError);
    } else if (data) {
      setSession(data.session);
      setNote(data.note ?? null);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return { session, note, loading, error, refetch: fetchSession };
}

export function useDeleteTranscription() {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteSession = useCallback(async (id: string): Promise<boolean> => {
    setDeleting(true);
    setError(null);

    const { error: apiError } = await transcriptionsApi.deleteSession(id);

    if (apiError) {
      setError(apiError);
      setDeleting(false);
      return false;
    }

    setDeleting(false);
    return true;
  }, []);

  return { deleteSession, deleting, error };
}
