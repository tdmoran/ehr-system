import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatientTranscriptions } from '../../hooks/usePatientTranscriptions';
import { useDeleteTranscription } from '../../hooks/useTranscriptions';
import type { TranscriptionSession, TranscriptionStatus } from '../../api/transcriptions';
import { EyeIcon, PencilIcon, TrashIcon, SpinnerIcon, MicrophoneIcon } from '../transcriptions/transcription-icons';

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
        <MicrophoneIcon className="w-12 h-12 mx-auto text-navy-300 dark:text-navy-500 mb-3" />
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
                      <EyeIcon className="w-5 h-5" />
                    </button>
                    {session.status === 'completed' && (
                      <button
                        onClick={() => handleEdit(session.id)}
                        className="p-3 text-navy-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Edit note"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(session)}
                      disabled={deletingId === session.id || deleting || session.status === 'recording' || session.status === 'processing'}
                      className="p-3 text-navy-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Delete session"
                    >
                      {deletingId === session.id ? (
                        <SpinnerIcon className="w-5 h-5 animate-spin" />
                      ) : (
                        <TrashIcon className="w-5 h-5" />
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
