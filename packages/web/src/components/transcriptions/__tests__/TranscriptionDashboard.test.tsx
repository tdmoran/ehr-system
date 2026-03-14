import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TranscriptionDashboard } from '../TranscriptionDashboard';

// ─── Mock useTranscriptions hook ────────────────────────────────────────────

const mockUseTranscriptions = {
  sessions: [] as unknown[],
  loading: false,
  error: null as string | null,
  filters: { status: '', patientSearch: '', startDate: '', endDate: '' },
  sort: { sortBy: 'createdAt', sortOrder: 'desc' },
  pagination: { page: 1, limit: 10, total: 0 },
  updateFilters: vi.fn(),
  updateSort: vi.fn(),
  goToPage: vi.fn(),
  resetFilters: vi.fn(),
  refetch: vi.fn(),
};

const mockDeleteSession = vi.fn();
const mockUseDeleteTranscription = {
  deleteSession: mockDeleteSession,
  deleting: false,
  error: null,
};

vi.mock('../../../hooks/useTranscriptions', () => ({
  useTranscriptions: () => mockUseTranscriptions,
  useDeleteTranscription: () => mockUseDeleteTranscription,
}));

// ─── Test Data ──────────────────────────────────────────────────────────────

const MOCK_SESSION = {
  id: 'session-1',
  patientId: 'patient-1',
  patientFirstName: 'John',
  patientLastName: 'Smith',
  providerId: 'provider-1',
  status: 'completed' as const,
  createdAt: '2026-03-01T10:00:00Z',
  durationSeconds: 185,
  templateUsed: 'soap',
  errorMessage: null,
};

const MOCK_SESSION_RECORDING = {
  ...MOCK_SESSION,
  id: 'session-2',
  status: 'recording' as const,
  durationSeconds: null,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('TranscriptionDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTranscriptions.sessions = [];
    mockUseTranscriptions.loading = false;
    mockUseTranscriptions.error = null;
    mockUseTranscriptions.pagination = { page: 1, limit: 10, total: 0 };
    mockUseTranscriptions.filters = { status: '', patientSearch: '', startDate: '', endDate: '' };
  });

  it('renders the dashboard header', () => {
    render(<TranscriptionDashboard />);

    expect(screen.getByText('AI Transcriptions')).toBeInTheDocument();
    expect(screen.getByText(/Manage AI scribe sessions/)).toBeInTheDocument();
  });

  it('shows New Session button when callback is provided', () => {
    const onCreateSession = vi.fn();
    render(<TranscriptionDashboard onCreateSession={onCreateSession} />);

    const buttons = screen.getAllByText('New Session');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('does not show New Session button when callback is not provided', () => {
    render(<TranscriptionDashboard />);

    expect(screen.queryByText('New Session')).not.toBeInTheDocument();
  });

  it('shows loading spinner when loading', () => {
    mockUseTranscriptions.loading = true;

    render(<TranscriptionDashboard />);

    expect(screen.getByText('Loading sessions...')).toBeInTheDocument();
  });

  it('shows error message with retry button', () => {
    mockUseTranscriptions.error = 'Failed to load sessions';

    render(<TranscriptionDashboard />);

    expect(screen.getByText('Failed to load sessions')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('shows empty state when no sessions', () => {
    mockUseTranscriptions.sessions = [];

    render(<TranscriptionDashboard />);

    expect(screen.getByText('No transcription sessions yet')).toBeInTheDocument();
  });

  it('renders sessions in a table', () => {
    mockUseTranscriptions.sessions = [MOCK_SESSION];
    mockUseTranscriptions.pagination = { page: 1, limit: 10, total: 1 };

    render(<TranscriptionDashboard />);

    // Desktop + mobile both render, so use getAllByText
    expect(screen.getAllByText('Smith, John').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('3:05').length).toBeGreaterThanOrEqual(1);
  });

  it('shows status badge with correct text', () => {
    mockUseTranscriptions.sessions = [MOCK_SESSION_RECORDING];
    mockUseTranscriptions.pagination = { page: 1, limit: 10, total: 1 };

    render(<TranscriptionDashboard />);

    expect(screen.getAllByText('Recording').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onViewSession when view button is clicked', async () => {
    const user = userEvent.setup();
    const onViewSession = vi.fn();
    mockUseTranscriptions.sessions = [MOCK_SESSION];
    mockUseTranscriptions.pagination = { page: 1, limit: 10, total: 1 };

    render(<TranscriptionDashboard onViewSession={onViewSession} />);

    // Click the view button (title="View session")
    const viewButtons = screen.getAllByTitle('View session');
    await user.click(viewButtons[0]);

    expect(onViewSession).toHaveBeenCalledWith('session-1');
  });

  it('calls onEditSession only for completed sessions', () => {
    const onEditSession = vi.fn();
    mockUseTranscriptions.sessions = [MOCK_SESSION, MOCK_SESSION_RECORDING];
    mockUseTranscriptions.pagination = { page: 1, limit: 10, total: 2 };

    render(<TranscriptionDashboard onEditSession={onEditSession} />);

    const editButtons = screen.getAllByTitle('Edit note');
    // Only completed session should have edit button
    expect(editButtons).toHaveLength(1);
  });

  it('disables delete button for recording sessions', () => {
    mockUseTranscriptions.sessions = [MOCK_SESSION_RECORDING];
    mockUseTranscriptions.pagination = { page: 1, limit: 10, total: 1 };

    render(<TranscriptionDashboard />);

    const deleteButtons = screen.getAllByTitle('Delete session');
    expect(deleteButtons[0]).toBeDisabled();
  });

  it('calls updateFilters when status filter changes', async () => {
    const user = userEvent.setup();
    render(<TranscriptionDashboard />);

    const statusSelect = screen.getByRole('combobox');
    await user.selectOptions(statusSelect, 'completed');

    expect(mockUseTranscriptions.updateFilters).toHaveBeenCalledWith({
      status: 'completed',
    });
  });

  it('shows Clear filters button when filters are active', () => {
    mockUseTranscriptions.filters = {
      status: 'completed',
      patientSearch: '',
      startDate: '',
      endDate: '',
    };
    mockUseTranscriptions.pagination = { page: 1, limit: 10, total: 5 };

    render(<TranscriptionDashboard />);

    expect(screen.getByText('Clear filters')).toBeInTheDocument();
    expect(screen.getByText(/5 results? found/)).toBeInTheDocument();
  });

  it('calls resetFilters when Clear filters is clicked', async () => {
    const user = userEvent.setup();
    mockUseTranscriptions.filters = {
      status: 'completed',
      patientSearch: '',
      startDate: '',
      endDate: '',
    };
    mockUseTranscriptions.pagination = { page: 1, limit: 10, total: 5 };

    render(<TranscriptionDashboard />);

    await user.click(screen.getByText('Clear filters'));
    expect(mockUseTranscriptions.resetFilters).toHaveBeenCalled();
  });

  it('renders pagination when multiple pages exist', () => {
    mockUseTranscriptions.sessions = [MOCK_SESSION];
    mockUseTranscriptions.pagination = { page: 1, limit: 10, total: 25 };

    render(<TranscriptionDashboard />);

    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('disables Previous on first page', () => {
    mockUseTranscriptions.sessions = [MOCK_SESSION];
    mockUseTranscriptions.pagination = { page: 1, limit: 10, total: 25 };

    render(<TranscriptionDashboard />);

    expect(screen.getByText('Previous')).toBeDisabled();
  });

  it('shows "No matching sessions" when filters produce no results', () => {
    mockUseTranscriptions.sessions = [];
    mockUseTranscriptions.filters = {
      status: 'failed',
      patientSearch: '',
      startDate: '',
      endDate: '',
    };

    render(<TranscriptionDashboard />);

    expect(screen.getByText('No matching sessions')).toBeInTheDocument();
  });

  it('calls refetch when Try again is clicked after error', async () => {
    const user = userEvent.setup();
    mockUseTranscriptions.error = 'Server error';

    render(<TranscriptionDashboard />);

    await user.click(screen.getByText('Try again'));
    expect(mockUseTranscriptions.refetch).toHaveBeenCalled();
  });
});
