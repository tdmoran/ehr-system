import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatientTranscriptions } from '../../hooks/usePatientTranscriptions';
import { useDeleteTranscription } from '../../hooks/useTranscriptions';
import type { TranscriptionSession, TranscriptionStatus } from '../../api/transcriptions';

// ─── Status Badge ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TranscriptionStatus, { label: string; classes: string }> = {
  pending: { label: 'Pending', classes: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  recording: { label: 'Recording', classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  processing: { label: 'Processing', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  completed: { label: 'Completed', classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  failed: { label: 'Error', classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  cancelled: { label: 'Cancelled', classes: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
};

function StatusBadge({ status }: { status: TranscriptionStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}>
      {(status === 'recording' || status === 'processing') && (
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${status === 'recording' ? 'bg-red-500' : 'bg-amber-500'}`} />
      )}
      {config.label}
    </span>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface PatientTranscriptionHistoryProps {
  patientId: string;
}

export function PatientTranscriptionHistory({ patientId }: PatientTranscriptionHistoryProps) {
  const navigate = useNavigate();
  const { sessions, loading, error, refetch } = usePatientTranscriptions(patientId);
  const { deleteSession, deleting } = useDeleteTranscription();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (session: TranscriptionSession) => {
    if (session.status === 'recording' || session.status === 'processing') return;
    if (!confirm(`Delete transcription session from ${formatDate(session.createdAt)}?`)) return;

    setDeletingId(session.id);
    const success = await deleteSession(session.id);
    if (success) refetch();
    setDeletingId(null);
  };

  const handleView = (sessionId: string) => {
    navigate(`/transcriptions/${sessionId}`);
  };

  const handleEdit = (sessionId: string) => {
    navigate(`/transcriptions/${sessionId}`);
  };

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-navy-500 dark:text-navy-400 font-body">Loading transcriptions...</span>
        </div>
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button onClick={refetch} className="mt-2 text-sm text-red-700 dark:text-red-300 hover:underline">
          Try again
        </button>
      </div>
    );
  }

  // ─── Empty State ────────────────────────────────────────────────────────────

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 border border-clinical-200 dark:border-gray-700 rounded-lg">
        <svg className="w-12 h-12 mx-auto text-navy-300 dark:text-navy-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
        <p className="text-lg font-display font-medium text-navy-700 dark:text-navy-300">No AI visit recordings yet</p>
        <p className="text-sm text-navy-500 dark:text-navy-400 mt-1">
          Use the "Record Visit" button to start an AI scribe session for this patient
        </p>
      </div>
    );
  }

  // ─── Session List ───────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-gray-800 border border-clinical-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-clinical-200 dark:border-gray-700 bg-clinical-50 dark:bg-gray-750">
              <th className="text-left px-4 py-3 font-medium text-navy-500 dark:text-gray-400">Date</th>
              <th className="text-left px-4 py-3 font-medium text-navy-500 dark:text-gray-400">Duration</th>
              <th className="text-left px-4 py-3 font-medium text-navy-500 dark:text-gray-400">Status</th>
              <th className="text-left px-4 py-3 font-medium text-navy-500 dark:text-gray-400">Template</th>
              <th className="text-right px-4 py-3 font-medium text-navy-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clinical-100 dark:divide-gray-700">
            {sessions.map((session) => (
              <tr key={session.id} className="hover:bg-clinical-50 dark:hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-navy-900 dark:text-white">{formatDate(session.createdAt)}</div>
                  <div className="text-xs text-navy-400 dark:text-gray-500">
                    {new Date(session.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td className="px-4 py-3 text-navy-600 dark:text-gray-300 tabular-nums">
                  {formatDuration(session.durationSeconds)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={session.status} />
                </td>
                <td className="px-4 py-3 text-navy-500 dark:text-gray-400">
                  {session.templateUsed || '--'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleView(session.id)}
                      className="p-3 text-navy-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
                      title="View session"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    {session.status === 'completed' && (
                      <button
                        onClick={() => handleEdit(session.id)}
                        className="p-3 text-navy-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Edit note"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(session)}
                      disabled={deletingId === session.id || deleting || session.status === 'recording' || session.status === 'processing'}
                      className="p-3 text-navy-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Delete session"
                    >
                      {deletingId === session.id ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
