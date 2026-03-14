import { useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import TranscriptionLayout from '../components/transcriptions/TranscriptionLayout';
import { TranscriptionDashboard } from '../components/transcriptions/TranscriptionDashboard';
import { LiveRecording } from '../components/transcriptions/LiveRecording';
import { NoteEditor } from '../components/transcriptions/NoteEditor';
import ErrorBoundary from '../components/ErrorBoundary';
import type { TranscriptionSession } from '../api/transcriptions';

// ─── Sub-route views ────────────────────────────────────────────────────────

function DashboardView() {
  const navigate = useNavigate();

  const handleCreateSession = useCallback(() => {
    navigate('/transcriptions/new');
  }, [navigate]);

  const handleViewSession = useCallback(
    (sessionId: string) => {
      navigate(`/transcriptions/${sessionId}`);
    },
    [navigate],
  );

  const handleEditSession = useCallback(
    (sessionId: string) => {
      navigate(`/transcriptions/${sessionId}`);
    },
    [navigate],
  );

  // Keyboard shortcuts for dashboard view
  useKeyboardShortcuts([
    { key: 'n', ctrl: true, handler: handleCreateSession },
  ]);

  return (
    <ErrorBoundary>
      <TranscriptionDashboard
        onCreateSession={handleCreateSession}
        onViewSession={handleViewSession}
        onEditSession={handleEditSession}
      />
    </ErrorBoundary>
  );
}

function NewRecordingView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  // Parse patientId from query params (e.g. /transcriptions/new?patientId=xxx)
  const searchParams = new URLSearchParams(location.search);
  const patientId = searchParams.get('patientId') ?? undefined;
  const fromPatientChart = Boolean(patientId);

  const handleSessionComplete = useCallback(
    (session: TranscriptionSession) => {
      if (fromPatientChart && patientId) {
        const name = session.patientFirstName && session.patientLastName
          ? `${session.patientFirstName} ${session.patientLastName}`
          : 'patient';
        addToast(`Visit recorded successfully for ${name}.`, 'success');
        navigate(`/patients/${patientId}`);
      } else {
        addToast('Recording completed. Note generated successfully.', 'success');
        navigate(`/transcriptions/${session.id}`);
      }
    },
    [navigate, addToast, fromPatientChart, patientId],
  );

  const handleCancel = useCallback(() => {
    addToast('Recording cancelled.', 'info');
    if (fromPatientChart && patientId) {
      navigate(`/patients/${patientId}`);
    } else {
      navigate('/transcriptions');
    }
  }, [navigate, addToast, fromPatientChart, patientId]);

  // Keyboard shortcuts for recording view
  useKeyboardShortcuts([
    {
      key: 'n',
      ctrl: true,
      handler: () => navigate('/transcriptions/new'),
    },
  ]);

  return (
    <ErrorBoundary>
      <LiveRecording
        initialPatientId={patientId}
        fromPatientChart={fromPatientChart}
        onSessionComplete={handleSessionComplete}
        onCancel={handleCancel}
      />
    </ErrorBoundary>
  );
}

function SessionDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleClose = useCallback(() => {
    navigate('/transcriptions');
  }, [navigate]);

  const handleFinalized = useCallback(() => {
    addToast('Note finalized and added to patient record.', 'success');
    navigate('/transcriptions');
  }, [navigate, addToast]);

  // Keyboard shortcuts for editor view
  useKeyboardShortcuts([
    { key: 'n', ctrl: true, handler: () => navigate('/transcriptions/new') },
  ]);

  if (!id) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Session not found.</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[500px]">
        <NoteEditor
          sessionId={id}
          onClose={handleClose}
          onFinalized={handleFinalized}
        />
      </div>
    </ErrorBoundary>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function TranscriptionsPage() {
  const location = useLocation();

  const getView = () => {
    const path = location.pathname;

    if (path === '/transcriptions/new') {
      return <NewRecordingView />;
    }

    // Match /transcriptions/:id (any path segment after /transcriptions/ that isn't "new")
    const idMatch = path.match(/^\/transcriptions\/([^/]+)$/);
    if (idMatch && idMatch[1] !== 'new') {
      return <SessionDetailView />;
    }

    return <DashboardView />;
  };

  return (
    <TranscriptionLayout>
      {getView()}
    </TranscriptionLayout>
  );
}
