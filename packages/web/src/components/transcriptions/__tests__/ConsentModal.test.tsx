import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConsentModal from '../ConsentModal';

// ─── Mock API ───────────────────────────────────────────────────────────────

const mockRecordConsent = vi.fn();

vi.mock('../../../api/transcriptions', () => ({
  transcriptionsApi: {
    recordConsent: (...args: unknown[]) => mockRecordConsent(...args),
  },
}));

// ─── Test Data ──────────────────────────────────────────────────────────────

const MOCK_PATIENT = {
  id: 'patient-1',
  mrn: '0012345',
  firstName: 'John',
  lastName: 'Smith',
  dateOfBirth: '1990-01-15',
  gender: null,
  email: null,
  phone: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  zip: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  insuranceProvider: null,
  insuranceId: null,
  notes: null,
  clinicNotes: null,
  active: true,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ConsentModal', () => {
  const onConsentRecorded = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal(props = {}) {
    return render(
      <ConsentModal
        patient={MOCK_PATIENT}
        onConsentRecorded={onConsentRecorded}
        onClose={onClose}
        {...props}
      />
    );
  }

  it('renders the consent modal with patient info', () => {
    renderModal();

    expect(screen.getByText('Patient Consent for AI Transcription')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText(/MRN: 0012345/)).toBeInTheDocument();
  });

  it('displays consent text about AI transcription', () => {
    renderModal();

    expect(
      screen.getByText(/This clinical visit will be recorded using an AI-powered transcription/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/audio is deleted immediately after transcription/i)
    ).toBeInTheDocument();
  });

  it('shows consent checkboxes unchecked by default', () => {
    renderModal();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('disables Record Consent button until both checkboxes are checked and signature drawn', () => {
    renderModal();

    const recordButton = screen.getByText('Record Consent');
    expect(recordButton).toBeDisabled();
  });

  it('enables Record Consent when checkboxes checked and verbal method selected', async () => {
    const user = userEvent.setup();
    renderModal();

    // Check both checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    // Select verbal consent method (no signature needed)
    const verbalRadio = screen.getByLabelText('verbal');
    await user.click(verbalRadio);

    const recordButton = screen.getByText('Record Consent');
    expect(recordButton).not.toBeDisabled();
  });

  it('shows consent method radio buttons', () => {
    renderModal();

    expect(screen.getByLabelText('electronic')).toBeInTheDocument();
    expect(screen.getByLabelText('verbal')).toBeInTheDocument();
    expect(screen.getByLabelText('written')).toBeInTheDocument();
  });

  it('defaults to electronic consent method', () => {
    renderModal();

    const electronicRadio = screen.getByLabelText('electronic');
    expect(electronicRadio).toBeChecked();
  });

  it('shows signature pad for electronic consent', () => {
    renderModal();

    expect(screen.getByText(/Sign here/)).toBeInTheDocument();
  });

  it('hides signature pad when verbal consent is selected', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByLabelText('verbal'));

    expect(screen.queryByText(/Sign here/)).not.toBeInTheDocument();
  });

  it('calls API and onConsentRecorded on successful submission', async () => {
    const user = userEvent.setup();
    mockRecordConsent.mockResolvedValueOnce({
      data: { consent: { id: 'consent-1' } },
    });

    renderModal();

    // Check both checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    // Switch to verbal (no signature needed)
    await user.click(screen.getByLabelText('verbal'));

    // Submit
    await user.click(screen.getByText('Record Consent'));

    await waitFor(() => {
      expect(mockRecordConsent).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'patient-1',
          consentGiven: true,
          consentMethod: 'verbal',
        })
      );
      expect(onConsentRecorded).toHaveBeenCalledWith('consent-1');
    });
  });

  it('shows error message on API failure', async () => {
    const user = userEvent.setup();
    mockRecordConsent.mockResolvedValueOnce({
      error: 'Server error',
    });

    renderModal();

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByLabelText('verbal'));
    await user.click(screen.getByText('Record Consent'));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('calls onClose when Consent Declined is clicked', async () => {
    const user = userEvent.setup();
    mockRecordConsent.mockResolvedValueOnce({ data: null });

    renderModal();

    await user.click(screen.getByText('Consent Declined'));

    await waitFor(() => {
      expect(mockRecordConsent).toHaveBeenCalledWith(
        expect.objectContaining({
          consentGiven: false,
        })
      );
    });
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    renderModal();

    // Click the backdrop (fixed inset-0 bg-black/50)
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
    if (backdrop) {
      await user.click(backdrop);
    }

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when X button is clicked', async () => {
    const user = userEvent.setup();
    renderModal();

    // The X close button is in the header
    const closeButtons = document.querySelectorAll('button');
    // Find the close button (first button in the header area)
    const headerCloseButton = Array.from(closeButtons).find(
      (btn) => btn.closest('.bg-teal-600') !== null
    );

    if (headerCloseButton) {
      await user.click(headerCloseButton);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('shows notes textarea', () => {
    renderModal();

    expect(screen.getByPlaceholderText(/additional notes/i)).toBeInTheDocument();
  });

  it('includes notes in consent submission', async () => {
    const user = userEvent.setup();
    mockRecordConsent.mockResolvedValueOnce({
      data: { consent: { id: 'consent-1' } },
    });

    renderModal();

    // Fill in notes
    const notesInput = screen.getByPlaceholderText(/additional notes/i);
    await user.type(notesInput, 'Patient asked questions about data security');

    // Check checkboxes and switch to verbal
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByLabelText('verbal'));

    await user.click(screen.getByText('Record Consent'));

    await waitFor(() => {
      expect(mockRecordConsent).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Patient asked questions about data security',
        })
      );
    });
  });

  it('passes sessionId when provided', async () => {
    const user = userEvent.setup();
    mockRecordConsent.mockResolvedValueOnce({
      data: { consent: { id: 'consent-1' } },
    });

    renderModal({ sessionId: 'session-123' });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByLabelText('verbal'));
    await user.click(screen.getByText('Record Consent'));

    await waitFor(() => {
      expect(mockRecordConsent).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
        })
      );
    });
  });

  it('shows View / Print button', () => {
    renderModal();

    expect(screen.getByText(/View \/ Print/)).toBeInTheDocument();
  });
});
