import { useState } from 'react';
import { useTranscriptions, useDeleteTranscription } from '../../hooks/useTranscriptions';
import type { TranscriptionSession, TranscriptionStatus } from '../../api/transcriptions';
import {
  PlusIcon,
  SearchIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  MicrophoneIcon,
  SpinnerIcon,
  SortIcon,
} from './transcription-icons';

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

                  {/* Mobile: prev/next only */}
                  <div className="flex items-center gap-2 md:hidden">
                    <button
                      onClick={() => goToPage(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => goToPage(pagination.page + 1)}
                      disabled={pagination.page >= totalPages}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                    >
                      Next
                    </button>
                  </div>

                  {/* Desktop: full page numbers */}
                  <div className="hidden md:flex items-center gap-1">
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

