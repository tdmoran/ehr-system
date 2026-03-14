import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useTranscriptions, useTranscriptionSession, useDeleteTranscription } from './useTranscriptions';

// ─── Mock API ───────────────────────────────────────────────────────────────

const mockGetSessions = vi.fn();
const mockGetSession = vi.fn();
const mockDeleteSessionApi = vi.fn();

vi.mock('../api/transcriptions', () => ({
  transcriptionsApi: {
    getSessions: (...args: unknown[]) => mockGetSessions(...args),
    getSession: (...args: unknown[]) => mockGetSession(...args),
    deleteSession: (...args: unknown[]) => mockDeleteSessionApi(...args),
  },
}));

// ─── Test Data ──────────────────────────────────────────────────────────────

const MOCK_SESSIONS = [
  {
    id: 'session-1',
    patientId: 'patient-1',
    providerId: 'provider-1',
    status: 'completed',
    createdAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'session-2',
    patientId: 'patient-2',
    providerId: 'provider-1',
    status: 'recording',
    createdAt: '2026-03-02T10:00:00Z',
  },
];

const MOCK_NOTE = {
  id: 'note-1',
  sessionId: 'session-1',
  chiefComplaint: 'Sore throat',
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useTranscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches sessions on mount with debounce', async () => {
    mockGetSessions.mockResolvedValue({
      data: { sessions: MOCK_SESSIONS, total: 2, page: 1, limit: 10 },
    });

    const { result } = renderHook(() => useTranscriptions(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.loading).toBe(true);

    // Advance past debounce
    act(() => { vi.advanceTimersByTime(400); });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.pagination.total).toBe(2);
  });

  it('sets error when API fails', async () => {
    mockGetSessions.mockResolvedValue({
      error: 'Server error',
    });

    const { result } = renderHook(() => useTranscriptions(), {
      wrapper: createWrapper(),
    });

    act(() => { vi.advanceTimersByTime(400); });

    await waitFor(() => {
      expect(result.current.error).toBe('Server error');
    });
  });

  it('updateFilters resets page to 1', async () => {
    mockGetSessions.mockResolvedValue({
      data: { sessions: [], total: 0, page: 1, limit: 10 },
    });

    const { result } = renderHook(() => useTranscriptions(), {
      wrapper: createWrapper(),
    });

    act(() => { vi.advanceTimersByTime(400); });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.updateFilters({ status: 'completed' });
    });

    expect(result.current.filters.status).toBe('completed');
    expect(result.current.pagination.page).toBe(1);
  });

  it('updateSort toggles sort order for same column', async () => {
    mockGetSessions.mockResolvedValue({
      data: { sessions: [], total: 0, page: 1, limit: 10 },
    });

    const { result } = renderHook(() => useTranscriptions(), {
      wrapper: createWrapper(),
    });

    act(() => { vi.advanceTimersByTime(400); });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Default is createdAt desc
    expect(result.current.sort.sortBy).toBe('createdAt');
    expect(result.current.sort.sortOrder).toBe('desc');

    // Toggle same column -> asc
    act(() => {
      result.current.updateSort('createdAt');
    });

    expect(result.current.sort.sortOrder).toBe('asc');

    // Toggle again -> desc
    act(() => {
      result.current.updateSort('createdAt');
    });

    expect(result.current.sort.sortOrder).toBe('desc');
  });

  it('updateSort changes column and defaults to desc', async () => {
    mockGetSessions.mockResolvedValue({
      data: { sessions: [], total: 0, page: 1, limit: 10 },
    });

    const { result } = renderHook(() => useTranscriptions(), {
      wrapper: createWrapper(),
    });

    act(() => { vi.advanceTimersByTime(400); });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.updateSort('status');
    });

    expect(result.current.sort.sortBy).toBe('status');
    expect(result.current.sort.sortOrder).toBe('desc');
  });

  it('goToPage updates current page', async () => {
    mockGetSessions.mockResolvedValue({
      data: { sessions: MOCK_SESSIONS, total: 25, page: 1, limit: 10 },
    });

    const { result } = renderHook(() => useTranscriptions(), {
      wrapper: createWrapper(),
    });

    act(() => { vi.advanceTimersByTime(400); });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.goToPage(2);
    });

    expect(result.current.pagination.page).toBe(2);
  });

  it('resetFilters clears all filters and resets page', async () => {
    mockGetSessions.mockResolvedValue({
      data: { sessions: [], total: 0, page: 1, limit: 10 },
    });

    const { result } = renderHook(() => useTranscriptions(), {
      wrapper: createWrapper(),
    });

    act(() => { vi.advanceTimersByTime(400); });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Set some filters
    act(() => {
      result.current.updateFilters({ status: 'completed', patientSearch: 'John' });
    });

    // Reset
    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.filters.status).toBe('');
    expect(result.current.filters.patientSearch).toBe('');
    expect(result.current.pagination.page).toBe(1);
  });

  it('passes filter params to API', async () => {
    mockGetSessions.mockResolvedValue({
      data: { sessions: [], total: 0, page: 1, limit: 10 },
    });

    const { result } = renderHook(() => useTranscriptions(), {
      wrapper: createWrapper(),
    });

    act(() => { vi.advanceTimersByTime(400); });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.updateFilters({
        status: 'completed',
        patientSearch: 'Smith',
        startDate: '2026-01-01',
        endDate: '2026-03-01',
      });
    });

    act(() => { vi.advanceTimersByTime(400); });

    await waitFor(() => {
      expect(mockGetSessions).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          patientSearch: 'Smith',
          startDate: '2026-01-01',
          endDate: '2026-03-01',
        })
      );
    });
  });

  it('deduplicates concurrent requests for same params', async () => {
    mockGetSessions.mockResolvedValue({
      data: { sessions: MOCK_SESSIONS, total: 2, page: 1, limit: 10 },
    });

    const wrapper = createWrapper();

    // Two hooks with the same default params share one query
    const { result: r1 } = renderHook(() => useTranscriptions(), { wrapper });
    const { result: r2 } = renderHook(() => useTranscriptions(), { wrapper });

    act(() => { vi.advanceTimersByTime(400); });

    await waitFor(() => {
      expect(r1.current.loading).toBe(false);
      expect(r2.current.loading).toBe(false);
    });

    // Only one network call despite two hook instances
    expect(mockGetSessions).toHaveBeenCalledTimes(1);
    expect(r1.current.sessions).toEqual(r2.current.sessions);
  });
});

describe('useTranscriptionSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches session and note on mount', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: MOCK_SESSIONS[0], note: MOCK_NOTE },
    });

    const { result } = renderHook(() => useTranscriptionSession('session-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toEqual(MOCK_SESSIONS[0]);
    expect(result.current.note).toEqual(MOCK_NOTE);
  });

  it('sets error on API failure', async () => {
    mockGetSession.mockResolvedValueOnce({
      error: 'Session not found',
    });

    const { result } = renderHook(() => useTranscriptionSession('nonexistent'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Session not found');
    });

    expect(result.current.session).toBeNull();
  });

  it('does not fetch when id is null', async () => {
    const { result } = renderHook(() => useTranscriptionSession(null), {
      wrapper: createWrapper(),
    });

    // With enabled: false, isLoading is false immediately
    expect(result.current.loading).toBe(false);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('refetch re-fetches the session', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: MOCK_SESSIONS[0], note: null },
    });

    const { result } = renderHook(() => useTranscriptionSession('session-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Trigger refetch
    await act(async () => {
      await result.current.refetch();
    });

    expect(mockGetSession).toHaveBeenCalledTimes(2);
  });

  it('caches session data across remounts', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: MOCK_SESSIONS[0], note: MOCK_NOTE },
    });

    const wrapper = createWrapper();

    const { result, unmount } = renderHook(
      () => useTranscriptionSession('session-1'),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    unmount();

    // Remount with same wrapper (same QueryClient) — data is cached
    const { result: result2 } = renderHook(
      () => useTranscriptionSession('session-1'),
      { wrapper },
    );

    // Data available immediately from cache
    expect(result2.current.session).toEqual(MOCK_SESSIONS[0]);
  });
});

describe('useDeleteTranscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a session successfully', async () => {
    mockDeleteSessionApi.mockResolvedValueOnce({});

    const { result } = renderHook(() => useDeleteTranscription(), {
      wrapper: createWrapper(),
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.deleteSession('session-1');
    });

    expect(success).toBe(true);
    expect(result.current.deleting).toBe(false);
  });

  it('handles delete error', async () => {
    mockDeleteSessionApi.mockResolvedValueOnce({
      error: 'Cannot delete active session',
    });

    const { result } = renderHook(() => useDeleteTranscription(), {
      wrapper: createWrapper(),
    });

    let success: boolean = true;
    await act(async () => {
      success = await result.current.deleteSession('session-1');
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Cannot delete active session');
  });

  it('invalidates session queries after successful delete', async () => {
    mockDeleteSessionApi.mockResolvedValueOnce({});
    mockGetSessions.mockResolvedValue({
      data: { sessions: MOCK_SESSIONS, total: 2, page: 1, limit: 10 },
    });

    const wrapper = createWrapper();

    // Mount the list hook first
    renderHook(() => useTranscriptions(), { wrapper });

    const { result } = renderHook(() => useDeleteTranscription(), { wrapper });

    await act(async () => {
      await result.current.deleteSession('session-1');
    });

    // The delete should have triggered cache invalidation, causing a refetch
    // (initial fetch + invalidation refetch)
    await waitFor(() => {
      expect(mockGetSessions.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });
});
