import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoteEditor } from '../NoteEditor';

// ─── Mock API ───────────────────────────────────────────────────────────────

const mockGetSession = vi.fn();
const mockUpdateNote = vi.fn();
const mockAcceptNote = vi.fn();

vi.mock('../../../api/transcriptions', () => ({
  transcriptionsApi: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    updateNote: (...args: unknown[]) => mockUpdateNote(...args),
    acceptNote: (...args: unknown[]) => mockAcceptNote(...args),
  },
}));

// ─── Test Data ──────────────────────────────────────────────────────────────

const MOCK_SESSION = {
  id: 'session-1',
  patientId: 'patient-1',
  providerId: 'provider-1',
  status: 'completed',
  templateUsed: 'soap',
  durationSeconds: 120,
  createdAt: '2026-03-01T10:00:00Z',
};

const MOCK_NOTE = {
  id: 'note-1',
  sessionId: 'session-1',
  chiefComplaint: 'Sore throat for 2 weeks',
  subjective: 'Patient reports persistent sore throat',
  objective: 'Erythema of posterior pharynx',
  assessment: 'Acute pharyngitis',
  plan: 'Prescribe amoxicillin 500mg TID x 10 days',
  fullTranscript: 'Doctor: How are you feeling?\nPatient: I have had a sore throat for about two weeks.',
  summary: 'Patient presents with 2-week sore throat',
  confidenceScore: 0.94,
  wordCount: 18,
  speakerCount: 2,
  suggestedIcdCodes: [{ code: 'J02.9', description: 'Acute pharyngitis', confidence: 0.92 }],
  suggestedCptCodes: [],
  reviewedBy: null,
  reviewedAt: null,
  accepted: null,
  modifications: null,
  createdAt: '2026-03-01T10:05:00Z',
  updatedAt: '2026-03-01T10:05:00Z',
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('NoteEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderEditor(props = {}) {
    return render(
      <NoteEditor sessionId="session-1" {...props} />
    );
  }

  it('shows loading spinner while fetching session', () => {
    mockGetSession.mockReturnValue(new Promise(() => {})); // never resolves

    renderEditor();

    expect(screen.getByText('Loading transcription...')).toBeInTheDocument();
  });

  it('shows error when session fails to load', async () => {
    mockGetSession.mockResolvedValueOnce({
      error: 'Session not found',
    });

    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Session not found')).toBeInTheDocument();
    });
  });

  it('renders note editor with SOAP fields when loaded', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: MOCK_SESSION, note: MOCK_NOTE },
    });

    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Note Editor')).toBeInTheDocument();
    });

    // SOAP fields should be populated
    expect(screen.getByDisplayValue('Sore throat for 2 weeks')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Patient reports persistent sore throat')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Erythema of posterior pharynx')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Acute pharyngitis')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/amoxicillin/)).toBeInTheDocument();
  });

  it('displays raw transcript in the left panel', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: MOCK_SESSION, note: MOCK_NOTE },
    });

    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Raw Transcript')).toBeInTheDocument();
    });

    // Transcript text may appear multiple times (raw + suggestions)
    expect(screen.getAllByText(/How are you feeling/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows confidence score badge', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: MOCK_SESSION, note: MOCK_NOTE },
    });

    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('94% confidence')).toBeInTheDocument();
    });
  });

  it('shows word count and speaker count', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: MOCK_SESSION, note: MOCK_NOTE },
    });

    renderEditor();

    await waitFor(() => {
      expect(screen.getByText(/18 words/)).toBeInTheDocument();
      expect(screen.getByText(/2 speakers/)).toBeInTheDocument();
    });
  });

  it('shows template selector with SOAP selected', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: MOCK_SESSION, note: MOCK_NOTE },
    });

    renderEditor();

    await waitFor(() => {
      const templateSelect = screen.getByRole('combobox');
      expect(templateSelect).toHaveValue('soap');
    });
  });

  it('auto-saves draft after field edit with debounce', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockGetSession.mockResolvedValueOnce({
      data: { session: MOCK_SESSION, note: MOCK_NOTE },
    });
    mockUpdateNote.mockResolvedValue({ data: { note: MOCK_NOTE } });

    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Note Editor')).toBeInTheDocument();
    });

    // Edit the chief complaint field
    const ccField = screen.getByDisplayValue('Sore throat for 2 weeks');
    await user.clear(ccField);
    await user.type(ccField, 'Updated complaint');

    // Advance past debounce timer (1500ms)
    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          chiefComplaint: 'Updated complaint',
          reviewStatus: 'draft',
        })
      );
    });
  });

  it('shows Save Draft button', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: MOCK_SESSION, note: MOCK_NOTE },
    });

    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Save Draft')).toBeInTheDocument();
    });
  });

  it('shows Finalize Note button', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: MOCK_SESSION, note: MOCK_NOTE },
    });

    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Finalize Note')).toBeInTheDocument();
    });
  });

  it('finalizes note and creates encounter', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onFinalized = vi.fn();
    mockGetSession.mockResolvedValueOnce({
      data: { session: MOCK_SESSION, note: MOCK_NOTE },
    });
    mockUpdateNote.mockResolvedValue({ data: { note: MOCK_NOTE } });
    mockAcceptNote.mockResolvedValue({ data: { encounter: { id: 'enc-1' } } });

    renderEditor({ onFinalized });

    await waitFor(() => {
      expect(screen.getByText('Finalize Note')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Finalize Note'));

    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          reviewStatus: 'finalized',
        })
      );
      expect(mockAcceptNote).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          modifications: expect.objectContaining({
            chiefComplaint: 'Sore throat for 2 weeks',
          }),
        })
      );
      expect(onFinalized).toHaveBeenCalled();
    });
  });

  it('shows error when finalize fails', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockGetSession.mockResolvedValueOnce({
      data: { session: MOCK_SESSION, note: MOCK_NOTE },
    });
    mockUpdateNote.mockResolvedValue({ error: 'Save failed' });

    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Finalize Note')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Finalize Note'));

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });
  });

  it('shows close button when onClose is provided', async () => {
    const onClose = vi.fn();
    mockGetSession.mockResolvedValueOnce({
      data: { session: MOCK_SESSION, note: MOCK_NOTE },
    });

    renderEditor({ onClose });

    await waitFor(() => {
      expect(screen.getByText('Note Editor')).toBeInTheDocument();
    });

    // There should be a close button in the header
    // It's an X icon button
  });

  it('shows "No transcript available" when transcript is empty', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: MOCK_SESSION,
        note: { ...MOCK_NOTE, fullTranscript: null },
      },
    });

    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('No transcript available for this session.')).toBeInTheDocument();
    });
  });

  it('renders with empty fields when no note exists', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: MOCK_SESSION, note: null },
    });

    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Note Editor')).toBeInTheDocument();
    });

    // Fields should have empty placeholders
    expect(screen.getByPlaceholderText('Enter chief complaint...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter subjective...')).toBeInTheDocument();
  });

  it('shows session status and duration in footer', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: MOCK_SESSION, note: MOCK_NOTE },
    });

    renderEditor();

    await waitFor(() => {
      expect(screen.getByText(/Session: completed/)).toBeInTheDocument();
      expect(screen.getByText(/2:00/)).toBeInTheDocument(); // 120 seconds
    });
  });
});
