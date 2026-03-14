import { useState } from 'react';
import { useTranscriptions, useDeleteTranscription } from '../../hooks/useTranscriptions';
import type { TranscriptionSession, TranscriptionStatus } from '../../api/transcriptions';

// ─── Status Badge ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TranscriptionStatus, { label: string; classes: string }> = {
  pending: {
    label: 'Pending',
    classes: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  },
  recording: {
    label: 'Recording',
    classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  processing: {
    label: 'Processing',
    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  completed: {
    label: 'Completed',
    classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  failed: {
    label: 'Error',
    classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  cancelled: {
    label: 'Cancelled',
    classes: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  },
};

function StatusBadge({ status }: { status: TranscriptionStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}
    >
      {status === 'recording' && (
        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
      )}
      {status === 'processing' && (
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
      )}
      {config.label}
    </span>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function getPatientName(session: TranscriptionSession): string {
  if (session.patientFirstName && session.patientLastName) {
    return `${session.patientLastName}, ${session.patientFirstName}`;
  }
  return session.patientId.slice(0, 8) + '...';
}

// ─── Filter Statuses ────────────────────────────────────────────────────────

const FILTER_STATUSES: { value: TranscriptionStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'recording', label: 'Recording' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Error' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ─── Sort Headers ───────────────────────────────────────────────────────────

type SortableColumn = 'createdAt' | 'status' | 'durationSeconds';

function SortHeader({
  label,
  column,
  currentSort,
  currentOrder,
  onSort,
}: {
  label: string;
  column: SortableColumn;
  currentSort: string;
  currentOrder: string;
  onSort: (col: SortableColumn) => void;
}) {
  const isActive = currentSort === column;
  return (
    <button
      onClick={() => onSort(column)}
      className="flex items-center gap-1 text-left font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
    >
      {label}
      {isActive && (
        <SortIcon direction={currentOrder as 'asc' | 'desc'} />
      )}
    </button>
  );
}

// ─── Dashboard Component ────────────────────────────────────────────────────

interface TranscriptionDashboardProps {
  onCreateSession?: () => void;
  onViewSession?: (sessionId: string) => void;
  onEditSession?: (sessionId: string) => void;
}

export function TranscriptionDashboard({
  onCreateSession,
  onViewSession,
  onEditSession,
}: TranscriptionDashboardProps) {
  const {
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
  } = useTranscriptions();

  const { deleteSession, deleting } = useDeleteTranscription();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (session: TranscriptionSession) => {
    if (session.status === 'recording' || session.status === 'processing') {
      return;
    }

    if (!confirm(`Delete transcription session from ${formatDate(session.createdAt)}?`)) {
      return;
    }

    setDeletingId(session.id);
    const success = await deleteSession(session.id);
    if (success) {
      refetch();
    }
    setDeletingId(null);
  };

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const hasActiveFilters =
    filters.status !== '' ||
    filters.patientSearch !== '' ||
    filters.startDate !== '' ||
    filters.endDate !== '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            AI Transcriptions
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage AI scribe sessions and generated clinical notes
          </p>
        </div>
        {onCreateSession && (
          <button
            onClick={onCreateSession}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm shadow-sm"
          >
            <PlusIcon className="w-4 h-4" />
            New Session
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Patient Search */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Patient
            </label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name..."
                value={filters.patientSearch}
                onChange={(e) => updateFilters({ patientSearch: e.target.value })}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) =>
                updateFilters({ status: e.target.value as TranscriptionStatus | '' })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              {FILTER_STATUSES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              From
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => updateFilters({ startDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              To
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => updateFilters({ endDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Active filters indicator + reset */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {pagination.total} result{pagination.total !== 1 ? 's' : ''} found
            </span>
            <button
              onClick={resetFilters}
              className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={refetch}
            className="mt-2 text-sm text-red-700 dark:text-red-300 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 dark:text-gray-400">Loading sessions...</span>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          {sessions.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <MicrophoneIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                {hasActiveFilters ? 'No matching sessions' : 'No transcription sessions yet'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Start a new AI scribe session to begin'}
              </p>
              {!hasActiveFilters && onCreateSession && (
                <button
                  onClick={onCreateSession}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
                >
                  <PlusIcon className="w-4 h-4" />
                  New Session
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Patient
                      </th>
                      <th className="text-left px-4 py-3">
                        <SortHeader
                          label="Date"
                          column="createdAt"
                          currentSort={sort.sortBy}
                          currentOrder={sort.sortOrder}
                          onSort={updateSort}
                        />
                      </th>
                      <th className="text-left px-4 py-3">
                        <SortHeader
                          label="Duration"
                          column="durationSeconds"
                          currentSort={sort.sortBy}
                          currentOrder={sort.sortOrder}
                          onSort={updateSort}
                        />
                      </th>
                      <th className="text-left px-4 py-3">
                        <SortHeader
                          label="Status"
                          column="status"
                          currentSort={sort.sortBy}
                          currentOrder={sort.sortOrder}
                          onSort={updateSort}
                        />
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {sessions.map((session) => (
                      <tr
                        key={session.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {getPatientName(session)}
                          </div>
                          {session.templateUsed && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {session.templateUsed}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          <div>{formatDate(session.createdAt)}</div>
                          <div className="text-xs text-gray-400">
                            {formatTime(session.createdAt)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300 tabular-nums">
                          {formatDuration(session.durationSeconds)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={session.status} />
                          {session.errorMessage && (
                            <div className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={session.errorMessage}>
                              {session.errorMessage}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {onViewSession && (
                              <button
                                onClick={() => onViewSession(session.id)}
                                className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
                                title="View session"
                              >
                                <EyeIcon className="w-4 h-4" />
                              </button>
                            )}
                            {onEditSession && session.status === 'completed' && (
                              <button
                                onClick={() => onEditSession(session.id)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Edit note"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(session)}
                              disabled={
                                deletingId === session.id ||
                                deleting ||
                                session.status === 'recording' ||
                                session.status === 'processing'
                              }
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Delete session"
                            >
                              {deletingId === session.id ? (
                                <SpinnerIcon className="w-4 h-4 animate-spin" />
                              ) : (
                                <TrashIcon className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
                {sessions.map((session) => (
                  <div key={session.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {getPatientName(session)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatDate(session.createdAt)} at {formatTime(session.createdAt)}
                        </div>
                      </div>
                      <StatusBadge status={session.status} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        Duration: {formatDuration(session.durationSeconds)}
                      </span>
                      <div className="flex items-center gap-1">
                        {onViewSession && (
                          <button
                            onClick={() => onViewSession(session.id)}
                            className="p-1.5 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                        )}
                        {onEditSession && session.status === 'completed' && (
                          <button
                            onClick={() => onEditSession(session.id)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(session)}
                          disabled={
                            deletingId === session.id ||
                            session.status === 'recording' ||
                            session.status === 'processing'
                          }
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-30"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Page {pagination.page} of {totalPages} ({pagination.total} total)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => goToPage(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                    >
                      Previous
                    </button>
                    {generatePageNumbers(pagination.page, totalPages).map((pageNum, idx) =>
                      pageNum === null ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className="px-2 text-gray-400"
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`px-3 py-1.5 text-sm rounded-lg ${
                            pageNum === pagination.page
                              ? 'bg-teal-600 text-white'
                              : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => goToPage(pagination.page + 1)}
                      disabled={pagination.page >= totalPages}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Page Number Generation ─────────────────────────────────────────────────

function generatePageNumbers(
  current: number,
  total: number
): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | null)[] = [1];

  if (current > 3) {
    pages.push(null);
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push(null);
  }

  pages.push(total);

  return pages;
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

function MicrophoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
      />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function SortIcon({ direction }: { direction: 'asc' | 'desc' }) {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      {direction === 'asc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      )}
    </svg>
  );
}
