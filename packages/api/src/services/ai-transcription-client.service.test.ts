import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config before importing the module under test
vi.mock('../config/index.js', () => ({
  config: {
    aiTranscription: {
      enabled: true,
      apiBaseUrl: 'https://api.test.aitranscription.com',
      apiKey: 'test-api-key-123',
    },
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  AITranscriptionApiError,
  createAITranscriptionSession,
  getTranscript,
  generateStructuredNote,
  getSuggestedCodes,
  getSessionStatus,
  isAITranscriptionEnabled,
} from './ai-transcription-client.service.js';

describe('ai-transcription-client.service', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── AITranscriptionApiError ────────────────────────────────────────────────

  describe('AITranscriptionApiError', () => {
    it('stores status code and response body', () => {
      const error = new AITranscriptionApiError(429, 'Rate limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.responseBody).toBe('Rate limit exceeded');
      expect(error.message).toContain('429');
      expect(error.message).toContain('Rate limit exceeded');
    });

    it('is an instance of Error', () => {
      const error = new AITranscriptionApiError(500, 'Internal');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AITranscriptionApiError);
    });
  });

  // ─── isAITranscriptionEnabled ───────────────────────────────────────────────

  describe('isAITranscriptionEnabled', () => {
    it('returns true when config has enabled=true', () => {
      expect(isAITranscriptionEnabled()).toBe(true);
    });
  });

  // ─── createAITranscriptionSession ───────────────────────────────────────────

  describe('createAITranscriptionSession', () => {
    it('creates a session with correct request parameters', async () => {
      const mockResponse = {
        sessionId: 'ext-session-123',
        sessionUrl: 'https://widget.aitranscription.com/s/ext-session-123',
        status: 'created',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await createAITranscriptionSession({
        patientName: 'John Doe',
        dateOfBirth: '1990-01-15',
        language: 'en',
        templateType: 'soap',
      });

      expect(result).toEqual(mockResponse);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.test.aitranscription.com/sessions');
      expect(options.method).toBe('POST');
      expect(options.headers).toHaveProperty('Authorization', 'Bearer test-api-key-123');
      expect(options.headers).toHaveProperty('Content-Type', 'application/json');

      const body = JSON.parse(options.body);
      expect(body.patientName).toBe('John Doe');
      expect(body.language).toBe('en');
      expect(body.templateType).toBe('soap');
    });

    it('uses default language and template when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessionId: 'ext-1', sessionUrl: '', status: 'created' }),
      });

      await createAITranscriptionSession({});

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.language).toBe('en');
      expect(body.templateType).toBe('soap');
    });

    it('throws AITranscriptionApiError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(createAITranscriptionSession({})).rejects.toThrow(AITranscriptionApiError);

      try {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: () => Promise.resolve('Unauthorized'),
        });
        await createAITranscriptionSession({});
      } catch (err) {
        expect((err as AITranscriptionApiError).statusCode).toBe(401);
      }
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(createAITranscriptionSession({})).rejects.toThrow('Network failure');
    });
  });

  // ─── getTranscript ──────────────────────────────────────────────────────────

  describe('getTranscript', () => {
    it('fetches transcript for a session', async () => {
      const mockTranscript = {
        transcript: 'Doctor: How are you?\nPatient: Not great.',
        speakers: [
          { label: 'Doctor', text: 'How are you?' },
          { label: 'Patient', text: 'Not great.' },
        ],
        wordCount: 8,
        speakerCount: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTranscript),
      });

      const result = await getTranscript('ext-session-123');
      expect(result).toEqual(mockTranscript);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.test.aitranscription.com/sessions/ext-session-123/transcript');
    });

    it('encodes special characters in session ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ transcript: '', speakers: [], wordCount: 0, speakerCount: 0 }),
      });

      await getTranscript('session/with spaces');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('session%2Fwith%20spaces');
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Session not found'),
      });

      await expect(getTranscript('nonexistent')).rejects.toThrow(AITranscriptionApiError);
    });
  });

  // ─── generateStructuredNote ─────────────────────────────────────────────────

  describe('generateStructuredNote', () => {
    it('generates a structured note with SOAP fields', async () => {
      const mockNote = {
        chiefComplaint: 'Sore throat for 2 weeks',
        subjective: 'Patient reports persistent sore throat...',
        objective: 'Erythema of posterior pharynx...',
        assessment: 'Acute pharyngitis',
        plan: 'Prescribe amoxicillin...',
        summary: 'Patient presents with 2-week sore throat...',
        confidenceScore: 0.94,
        suggestedIcdCodes: [
          { code: 'J02.9', description: 'Acute pharyngitis, unspecified', confidence: 0.92 },
        ],
        suggestedCptCodes: [
          { code: '99213', description: 'Office visit, established', confidence: 0.88 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNote),
      });

      const result = await generateStructuredNote('ext-session-123', 'soap');

      expect(result.chiefComplaint).toBe('Sore throat for 2 weeks');
      expect(result.confidenceScore).toBe(0.94);
      expect(result.suggestedIcdCodes).toHaveLength(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/sessions/ext-session-123/note');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body).templateType).toBe('soap');
    });

    it('defaults to soap template type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await generateStructuredNote('ext-session-123');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.templateType).toBe('soap');
    });
  });

  // ─── getSuggestedCodes ──────────────────────────────────────────────────────

  describe('getSuggestedCodes', () => {
    it('fetches suggested ICD and CPT codes', async () => {
      const mockCodes = {
        icdCodes: [
          { code: 'J02.9', description: 'Acute pharyngitis', confidence: 0.92 },
        ],
        cptCodes: [
          { code: '99213', description: 'Office visit', confidence: 0.88 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCodes),
      });

      const result = await getSuggestedCodes('ext-session-123');
      expect(result.icdCodes).toHaveLength(1);
      expect(result.cptCodes).toHaveLength(1);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/sessions/ext-session-123/codes');
    });
  });

  // ─── getSessionStatus ──────────────────────────────────────────────────────

  describe('getSessionStatus', () => {
    it('fetches session status', async () => {
      const mockStatus = {
        sessionId: 'ext-session-123',
        status: 'completed',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      });

      const result = await getSessionStatus('ext-session-123');
      expect(result.status).toBe('completed');
    });

    it('returns error field when session has failed', async () => {
      const mockStatus = {
        sessionId: 'ext-session-123',
        status: 'failed',
        error: 'Audio quality too low',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      });

      const result = await getSessionStatus('ext-session-123');
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Audio quality too low');
    });
  });
});
