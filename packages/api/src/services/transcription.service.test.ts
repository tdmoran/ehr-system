import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockQuery = vi.fn();
const mockWithTransaction = vi.fn();

vi.mock('../db/index.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (fn: (client: unknown) => Promise<unknown>) => mockWithTransaction(fn),
}));

vi.mock('./ai-transcription-client.service.js', () => ({
  isAITranscriptionEnabled: vi.fn(() => true),
  createAITranscriptionSession: vi.fn(),
  generateStructuredNote: vi.fn(),
  getTranscript: vi.fn(),
  getSuggestedCodes: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import * as service from './transcription.service.js';
import * as aiClient from './ai-transcription-client.service.js';

// ─── Test Data ──────────────────────────────────────────────────────────────

const SESSION_ROW = {
  id: '11111111-1111-1111-1111-111111111111',
  encounter_id: null,
  appointment_id: 'appt-1',
  patient_id: 'patient-1',
  provider_id: 'provider-1',
  external_session_id: 'ext-session-1',
  external_provider: 'aiTranscription',
  status: 'pending',
  started_at: null,
  ended_at: null,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  duration_seconds: null,
  template_used: 'soap',
  language: 'en',
  error_message: null,
};

const NOTE_ROW = {
  id: '22222222-2222-2222-2222-222222222222',
  session_id: SESSION_ROW.id,
  chief_complaint: 'Sore throat',
  subjective: 'Patient reports sore throat for 2 weeks',
  objective: 'Erythema of posterior pharynx',
  assessment: 'Acute pharyngitis',
  plan: 'Prescribe amoxicillin',
  full_transcript: 'Doctor: How are you?\nPatient: Not great.',
  summary: 'Patient with sore throat',
  suggested_icd_codes: [{ code: 'J02.9', description: 'Acute pharyngitis', confidence: 0.92 }],
  suggested_cpt_codes: [{ code: '99213', description: 'Office visit', confidence: 0.88 }],
  confidence_score: 0.94,
  word_count: 8,
  speaker_count: 2,
  reviewed_by: null,
  reviewed_at: null,
  accepted: null,
  modifications: null,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

const TEMPLATE_ROW = {
  id: '33333333-3333-3333-3333-333333333333',
  provider_id: 'provider-1',
  name: 'My SOAP',
  template_type: 'soap',
  sections: [{ name: 'Subjective', prompt: 'Describe symptoms', required: true }],
  is_default: true,
  external_template_id: null,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

const CONSENT_ROW = {
  id: '44444444-4444-4444-4444-444444444444',
  patient_id: 'patient-1',
  provider_id: 'provider-1',
  session_id: SESSION_ROW.id,
  consent_given: true,
  consent_method: 'verbal',
  notes: null,
  recorded_at: new Date('2026-01-01'),
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('transcription.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── createSession ────────────────────────────────────────────────────────

  describe('createSession', () => {
    it('creates a session with AITranscription external provider', async () => {
      vi.mocked(aiClient.createAITranscriptionSession).mockResolvedValueOnce({
        sessionId: 'ext-session-1',
        sessionUrl: 'https://widget.test.com/s/ext-session-1',
        status: 'created',
      });

      mockQuery.mockResolvedValueOnce({
        rows: [SESSION_ROW],
      });

      const result = await service.createSession({
        patientId: 'patient-1',
        providerId: 'provider-1',
        appointmentId: 'appt-1',
        templateType: 'soap',
        language: 'en',
      });

      expect(result.session.patientId).toBe('patient-1');
      expect(result.session.externalProvider).toBe('aiTranscription');
      expect(result.externalSessionUrl).toBe('https://widget.test.com/s/ext-session-1');
      expect(aiClient.createAITranscriptionSession).toHaveBeenCalledOnce();
    });

    it('creates a built_in session when AITranscription is disabled', async () => {
      vi.mocked(aiClient.isAITranscriptionEnabled).mockReturnValueOnce(false);

      const builtInRow = { ...SESSION_ROW, external_provider: 'built_in', external_session_id: null };
      mockQuery.mockResolvedValueOnce({ rows: [builtInRow] });

      const result = await service.createSession({
        patientId: 'patient-1',
        providerId: 'provider-1',
      });

      expect(result.session.externalProvider).toBe('built_in');
      expect(result.externalSessionUrl).toBeUndefined();
      expect(aiClient.createAITranscriptionSession).not.toHaveBeenCalled();
    });

    it('throws when AITranscription API fails', async () => {
      vi.mocked(aiClient.createAITranscriptionSession).mockRejectedValueOnce(
        new Error('API unavailable')
      );

      await expect(
        service.createSession({ patientId: 'p1', providerId: 'pr1' })
      ).rejects.toThrow('API unavailable');
    });

    it('uses default template and language when not provided', async () => {
      vi.mocked(aiClient.createAITranscriptionSession).mockResolvedValueOnce({
        sessionId: 'ext-1', sessionUrl: '', status: 'created',
      });

      const row = { ...SESSION_ROW, template_used: 'soap', language: 'en' };
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      await service.createSession({ patientId: 'p1', providerId: 'pr1' });

      // Check the query args for defaults
      const queryArgs = mockQuery.mock.calls[0][1];
      expect(queryArgs[5]).toBe('soap'); // templateType default
      expect(queryArgs[6]).toBe('en');   // language default
    });
  });

  // ─── findSessionById ──────────────────────────────────────────────────────

  describe('findSessionById', () => {
    it('returns mapped session when found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [SESSION_ROW] });

      const result = await service.findSessionById(SESSION_ROW.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(SESSION_ROW.id);
      expect(result!.patientId).toBe('patient-1');
      expect(result!.status).toBe('pending');
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.findSessionById('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ─── findSessionsByPatientId ──────────────────────────────────────────────

  describe('findSessionsByPatientId', () => {
    it('returns array of sessions for a patient', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [SESSION_ROW, { ...SESSION_ROW, id: 'session-2' }] });

      const results = await service.findSessionsByPatientId('patient-1');
      expect(results).toHaveLength(2);
    });

    it('returns empty array when patient has no sessions', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const results = await service.findSessionsByPatientId('patient-no-sessions');
      expect(results).toEqual([]);
    });
  });

  // ─── updateSessionStatus ──────────────────────────────────────────────────

  describe('updateSessionStatus', () => {
    it('updates status to recording and sets started_at', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...SESSION_ROW, status: 'recording', started_at: new Date() }],
      });

      const result = await service.updateSessionStatus(SESSION_ROW.id, 'recording');
      expect(result!.status).toBe('recording');

      // Check the SQL includes started_at
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('started_at');
    });

    it('updates status to completed and sets ended_at and duration', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...SESSION_ROW, status: 'completed', ended_at: new Date(), duration_seconds: 120 }],
      });

      const result = await service.updateSessionStatus(SESSION_ROW.id, 'completed');
      expect(result!.status).toBe('completed');

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('ended_at');
      expect(sql).toContain('duration_seconds');
    });

    it('includes error message when provided', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...SESSION_ROW, status: 'failed', error_message: 'Processing failed' }],
      });

      const result = await service.updateSessionStatus(SESSION_ROW.id, 'failed', 'Processing failed');
      expect(result!.status).toBe('failed');
      expect(result!.errorMessage).toBe('Processing failed');

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('error_message');
    });

    it('returns null when session not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.updateSessionStatus('nonexistent', 'recording');
      expect(result).toBeNull();
    });
  });

  // ─── getSessionWithNote ──────────────────────────────────────────────────

  describe('getSessionWithNote', () => {
    it('returns session with note when both exist', async () => {
      // findSessionById
      mockQuery.mockResolvedValueOnce({ rows: [SESSION_ROW] });
      // note query
      mockQuery.mockResolvedValueOnce({ rows: [NOTE_ROW] });

      const result = await service.getSessionWithNote(SESSION_ROW.id);

      expect(result).not.toBeNull();
      expect(result!.session.id).toBe(SESSION_ROW.id);
      expect(result!.note).not.toBeNull();
      expect(result!.note!.chiefComplaint).toBe('Sore throat');
    });

    it('returns session with null note when no note exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [SESSION_ROW] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.getSessionWithNote(SESSION_ROW.id);

      expect(result!.session.id).toBe(SESSION_ROW.id);
      expect(result!.note).toBeNull();
    });

    it('returns null when session not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.getSessionWithNote('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ─── generateNote ─────────────────────────────────────────────────────────

  describe('generateNote', () => {
    it('calls AITranscription API and stores note in DB', async () => {
      // findSessionById
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...SESSION_ROW, external_session_id: 'ext-session-1', status: 'recording' }],
      });

      vi.mocked(aiClient.generateStructuredNote).mockResolvedValueOnce({
        chiefComplaint: 'Sore throat',
        subjective: 'Patient reports...',
        objective: 'Exam shows...',
        assessment: 'Pharyngitis',
        plan: 'Antibiotics',
        summary: 'Sore throat visit',
        confidenceScore: 0.94,
        suggestedIcdCodes: [{ code: 'J02.9', description: 'Acute pharyngitis', confidence: 0.92 }],
        suggestedCptCodes: [],
      });

      vi.mocked(aiClient.getTranscript).mockResolvedValueOnce({
        transcript: 'Doctor: How are you?',
        speakers: [{ label: 'Doctor', text: 'How are you?' }],
        wordCount: 4,
        speakerCount: 1,
      });

      // Insert note
      mockQuery.mockResolvedValueOnce({ rows: [NOTE_ROW] });
      // updateSessionStatus
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...SESSION_ROW, status: 'completed' }],
      });

      const note = await service.generateNote(SESSION_ROW.id, 'soap');

      expect(note.chiefComplaint).toBe('Sore throat');
      expect(aiClient.generateStructuredNote).toHaveBeenCalledWith('ext-session-1', 'soap');
      expect(aiClient.getTranscript).toHaveBeenCalledWith('ext-session-1');
    });

    it('throws when session not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(service.generateNote('nonexistent')).rejects.toThrow('Session not found');
    });

    it('throws when no external session ID', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...SESSION_ROW, external_session_id: null }],
      });

      await expect(service.generateNote(SESSION_ROW.id)).rejects.toThrow(
        'No external session ID'
      );
    });
  });

  // ─── rejectNote ────────────────────────────────────────────────────────────

  describe('rejectNote', () => {
    it('marks the note as rejected', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await service.rejectNote(SESSION_ROW.id, 'provider-1');

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('accepted = FALSE');
      expect(mockQuery.mock.calls[0][1]).toContain('provider-1');
    });
  });

  // ─── getSuggestedCodes ─────────────────────────────────────────────────────

  describe('getSuggestedCodes', () => {
    it('returns codes from existing note', async () => {
      // findSessionById
      mockQuery.mockResolvedValueOnce({ rows: [SESSION_ROW] });
      // note codes query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          suggested_icd_codes: [{ code: 'J02.9', description: 'Pharyngitis', confidence: 0.9 }],
          suggested_cpt_codes: [{ code: '99213', description: 'Visit', confidence: 0.85 }],
        }],
      });

      const result = await service.getSuggestedCodes(SESSION_ROW.id);
      expect(result.icdCodes).toHaveLength(1);
      expect(result.cptCodes).toHaveLength(1);
    });

    it('falls back to AITranscription API when no note exists', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...SESSION_ROW, external_session_id: 'ext-1' }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      vi.mocked(aiClient.getSuggestedCodes).mockResolvedValueOnce({
        icdCodes: [{ code: 'J02.9', description: 'Pharyngitis', confidence: 0.9 }],
        cptCodes: [],
      });

      const result = await service.getSuggestedCodes(SESSION_ROW.id);
      expect(result.icdCodes).toHaveLength(1);
      expect(aiClient.getSuggestedCodes).toHaveBeenCalledWith('ext-1');
    });

    it('returns empty arrays when no note and no external session', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...SESSION_ROW, external_session_id: null }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.getSuggestedCodes(SESSION_ROW.id);
      expect(result).toEqual({ icdCodes: [], cptCodes: [] });
    });

    it('throws when session not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(service.getSuggestedCodes('nonexistent')).rejects.toThrow('Session not found');
    });
  });

  // ─── updateNote ───────────────────────────────────────────────────────────

  describe('updateNote', () => {
    it('updates note fields', async () => {
      // find note ID
      mockQuery.mockResolvedValueOnce({ rows: [{ id: NOTE_ROW.id }] });
      // update note
      mockQuery.mockResolvedValueOnce({ rows: [NOTE_ROW] });

      const result = await service.updateNote(SESSION_ROW.id, {
        chiefComplaint: 'Updated complaint',
        subjective: 'Updated subjective',
      });

      expect(result.id).toBe(NOTE_ROW.id);
      const sql = mockQuery.mock.calls[1][0] as string;
      expect(sql).toContain('chief_complaint');
      expect(sql).toContain('subjective');
    });

    it('throws when no note exists for session', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateNote('no-note-session', { chiefComplaint: 'test' })
      ).rejects.toThrow('No note found');
    });

    it('returns existing note when no fields to update', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: NOTE_ROW.id }] });
      // Returns existing note on second query (select)
      mockQuery.mockResolvedValueOnce({ rows: [NOTE_ROW] });

      const result = await service.updateNote(SESSION_ROW.id, {});
      expect(result.id).toBe(NOTE_ROW.id);
    });
  });

  // ─── Template CRUD ────────────────────────────────────────────────────────

  describe('template operations', () => {
    describe('findTemplatesByProviderId', () => {
      it('returns templates for a provider', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [TEMPLATE_ROW] });

        const results = await service.findTemplatesByProviderId('provider-1');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('My SOAP');
      });
    });

    describe('findTemplateById', () => {
      it('returns template when found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [TEMPLATE_ROW] });

        const result = await service.findTemplateById(TEMPLATE_ROW.id);
        expect(result!.id).toBe(TEMPLATE_ROW.id);
      });

      it('returns null when not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const result = await service.findTemplateById('nonexistent');
        expect(result).toBeNull();
      });
    });

    describe('createTemplate', () => {
      it('creates a template', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [TEMPLATE_ROW] });

        const result = await service.createTemplate({
          providerId: 'provider-1',
          name: 'My SOAP',
          templateType: 'soap',
          sections: [{ name: 'Subjective', prompt: 'Describe', required: true }],
        });

        expect(result.name).toBe('My SOAP');
      });

      it('unsets other defaults when creating a default template', async () => {
        // Unset defaults query
        mockQuery.mockResolvedValueOnce({ rowCount: 1 });
        // Insert query
        mockQuery.mockResolvedValueOnce({ rows: [TEMPLATE_ROW] });

        await service.createTemplate({
          providerId: 'provider-1',
          name: 'My SOAP',
          templateType: 'soap',
          sections: [],
          isDefault: true,
        });

        expect(mockQuery).toHaveBeenCalledTimes(2);
        const firstSql = mockQuery.mock.calls[0][0] as string;
        expect(firstSql).toContain('is_default = FALSE');
      });
    });

    describe('updateTemplate', () => {
      it('updates template fields', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ ...TEMPLATE_ROW, name: 'Updated' }] });

        const result = await service.updateTemplate(TEMPLATE_ROW.id, { name: 'Updated' });
        expect(result!.name).toBe('Updated');
      });

      it('returns existing template when no changes', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [TEMPLATE_ROW] });

        const result = await service.updateTemplate(TEMPLATE_ROW.id, {});
        expect(result!.id).toBe(TEMPLATE_ROW.id);
      });
    });

    describe('deleteTemplate', () => {
      it('returns true on successful deletion', async () => {
        mockQuery.mockResolvedValueOnce({ rowCount: 1 });

        const result = await service.deleteTemplate(TEMPLATE_ROW.id);
        expect(result).toBe(true);
      });

      it('returns false when template not found', async () => {
        mockQuery.mockResolvedValueOnce({ rowCount: 0 });

        const result = await service.deleteTemplate('nonexistent');
        expect(result).toBe(false);
      });
    });
  });

  // ─── Consent CRUD ─────────────────────────────────────────────────────────

  describe('consent operations', () => {
    describe('recordConsent', () => {
      it('records patient consent', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [CONSENT_ROW] });

        const result = await service.recordConsent({
          patientId: 'patient-1',
          providerId: 'provider-1',
          sessionId: SESSION_ROW.id,
          consentGiven: true,
          consentMethod: 'verbal',
        });

        expect(result.consentGiven).toBe(true);
        expect(result.consentMethod).toBe('verbal');
        expect(result.patientId).toBe('patient-1');
      });

      it('records consent decline', async () => {
        const declinedRow = { ...CONSENT_ROW, consent_given: false };
        mockQuery.mockResolvedValueOnce({ rows: [declinedRow] });

        const result = await service.recordConsent({
          patientId: 'patient-1',
          providerId: 'provider-1',
          consentGiven: false,
          consentMethod: 'verbal',
          notes: 'Patient declined',
        });

        expect(result.consentGiven).toBe(false);
      });
    });

    describe('findConsentsByPatientId', () => {
      it('returns consent history for a patient', async () => {
        mockQuery.mockResolvedValueOnce({
          rows: [CONSENT_ROW, { ...CONSENT_ROW, id: 'consent-2' }],
        });

        const results = await service.findConsentsByPatientId('patient-1');
        expect(results).toHaveLength(2);
      });

      it('returns empty array when no consents', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const results = await service.findConsentsByPatientId('patient-no-consent');
        expect(results).toEqual([]);
      });
    });
  });
});
