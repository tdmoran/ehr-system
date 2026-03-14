import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mocks (vi.hoisted so they are available when vi.mock factories run) ────

const {
  mockTranscriptionService,
  mockLogAudit,
} = vi.hoisted(() => ({
  mockTranscriptionService: {
    createSession: vi.fn(),
    findSessionById: vi.fn(),
    findSessionsByPatientId: vi.fn(),
    updateSessionStatus: vi.fn(),
    getSessionWithNote: vi.fn(),
    generateNote: vi.fn(),
    acceptNote: vi.fn(),
    rejectNote: vi.fn(),
    getSuggestedCodes: vi.fn(),
    updateNote: vi.fn(),
    findTemplatesByProviderId: vi.fn(),
    findTemplateById: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    recordConsent: vi.fn(),
    findConsentsByPatientId: vi.fn(),
  },
  mockLogAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/transcription.service.js', () => mockTranscriptionService);

vi.mock('../middleware/audit.js', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

vi.mock('../config/index.js', () => ({
  config: {
    aiTranscription: { enabled: true },
  },
}));

// We need to mock auth middleware to inject user
vi.mock('../middleware/auth.js', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    // Simulate authenticated user from test header
    const role = req.headers['x-test-role'] as string || 'provider';
    const userId = req.headers['x-test-user-id'] as string || 'provider-1';
    req.user = {
      id: userId,
      email: 'test@example.com',
      role: role as 'provider' | 'nurse' | 'admin' | 'billing' | 'secretary',
      firstName: 'Test',
      lastName: 'User',
    };
    next();
  },
  authorize: (...roles: string[]) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  },
}));

vi.mock('../middleware/validate.js', () => ({
  validate: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../errors/index.js', async () => {
  const actual = await vi.importActual('../errors/index.js') as Record<string, unknown>;
  return actual;
});

import transcriptionRoutes from './transcriptions.js';

// ─── App Setup ──────────────────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/transcriptions', transcriptionRoutes);

  // Error handler
  app.use((err: Error & { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.statusCode ?? 500;
    res.status(status).json({ error: err.message });
  });

  return app;
}

// ─── Test Data ──────────────────────────────────────────────────────────────

const MOCK_SESSION = {
  id: 'session-1',
  patientId: 'patient-1',
  providerId: 'provider-1',
  status: 'pending',
  externalProvider: 'aiTranscription',
  createdAt: new Date().toISOString(),
};

const MOCK_NOTE = {
  id: 'note-1',
  sessionId: 'session-1',
  chiefComplaint: 'Sore throat',
  subjective: 'Patient reports...',
  objective: 'Exam shows...',
  assessment: 'Pharyngitis',
  plan: 'Antibiotics',
};

const MOCK_TEMPLATE = {
  id: 'template-1',
  providerId: 'provider-1',
  name: 'My SOAP',
  templateType: 'soap',
  sections: [],
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('transcription routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  // ─── POST /sessions ────────────────────────────────────────────────────────

  describe('POST /api/transcriptions/sessions', () => {
    it('creates a session and returns 201', async () => {
      mockTranscriptionService.createSession.mockResolvedValueOnce({
        session: MOCK_SESSION,
        externalSessionUrl: 'https://widget.test.com/s/1',
      });

      const res = await request(app)
        .post('/api/transcriptions/sessions')
        .set('x-test-role', 'provider')
        .send({ patientId: 'patient-1' });

      expect(res.status).toBe(201);
      expect(res.body.session).toBeDefined();
      expect(res.body.externalSessionUrl).toBe('https://widget.test.com/s/1');
    });

    it('returns 403 for unauthorized roles (secretary)', async () => {
      const res = await request(app)
        .post('/api/transcriptions/sessions')
        .set('x-test-role', 'secretary')
        .send({ patientId: 'patient-1' });

      expect(res.status).toBe(403);
    });

    it('allows nurse role to create sessions', async () => {
      mockTranscriptionService.createSession.mockResolvedValueOnce({
        session: MOCK_SESSION,
      });

      const res = await request(app)
        .post('/api/transcriptions/sessions')
        .set('x-test-role', 'nurse')
        .send({ patientId: 'patient-1' });

      expect(res.status).toBe(201);
    });

    it('logs an audit entry for HIPAA compliance', async () => {
      mockTranscriptionService.createSession.mockResolvedValueOnce({
        session: MOCK_SESSION,
      });

      await request(app)
        .post('/api/transcriptions/sessions')
        .set('x-test-role', 'provider')
        .send({ patientId: 'patient-1' });

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'create',
          resourceType: 'transcription_session',
          resourceId: 'session-1',
          patientId: 'patient-1',
        })
      );
    });
  });

  // ─── PATCH /sessions/:id/status ─────────────────────────────────────────

  describe('PATCH /api/transcriptions/sessions/:id/status', () => {
    it('updates session status', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce(MOCK_SESSION);
      mockTranscriptionService.updateSessionStatus.mockResolvedValueOnce({
        ...MOCK_SESSION,
        status: 'recording',
      });

      const res = await request(app)
        .patch('/api/transcriptions/sessions/session-1/status')
        .set('x-test-role', 'provider')
        .send({ status: 'recording' });

      expect(res.status).toBe(200);
      expect(res.body.session.status).toBe('recording');
    });

    it('returns 404 for nonexistent session', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/api/transcriptions/sessions/nonexistent/status')
        .set('x-test-role', 'provider')
        .send({ status: 'recording' });

      expect(res.status).toBe(404);
    });

    it('returns 403 when modifying another providers session', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce({
        ...MOCK_SESSION,
        providerId: 'other-provider',
      });

      const res = await request(app)
        .patch('/api/transcriptions/sessions/session-1/status')
        .set('x-test-role', 'provider')
        .set('x-test-user-id', 'provider-1')
        .send({ status: 'recording' });

      expect(res.status).toBe(403);
    });

    it('logs audit for status update', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce(MOCK_SESSION);
      mockTranscriptionService.updateSessionStatus.mockResolvedValueOnce({
        ...MOCK_SESSION,
        status: 'recording',
      });

      await request(app)
        .patch('/api/transcriptions/sessions/session-1/status')
        .set('x-test-role', 'provider')
        .send({ status: 'recording' });

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'update',
          resourceType: 'transcription_session',
          details: { status: 'recording' },
        })
      );
    });
  });

  // ─── GET /sessions/:id ──────────────────────────────────────────────────

  describe('GET /api/transcriptions/sessions/:id', () => {
    it('returns session with note', async () => {
      mockTranscriptionService.getSessionWithNote.mockResolvedValueOnce({
        session: MOCK_SESSION,
        note: MOCK_NOTE,
      });

      const res = await request(app)
        .get('/api/transcriptions/sessions/session-1')
        .set('x-test-role', 'provider');

      expect(res.status).toBe(200);
      expect(res.body.session).toBeDefined();
      expect(res.body.note).toBeDefined();
    });

    it('returns 404 for nonexistent session', async () => {
      mockTranscriptionService.getSessionWithNote.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/transcriptions/sessions/nonexistent')
        .set('x-test-role', 'provider');

      expect(res.status).toBe(404);
    });

    it('allows admin role to view', async () => {
      mockTranscriptionService.getSessionWithNote.mockResolvedValueOnce({
        session: MOCK_SESSION,
        note: null,
      });

      const res = await request(app)
        .get('/api/transcriptions/sessions/session-1')
        .set('x-test-role', 'admin');

      expect(res.status).toBe(200);
    });
  });

  // ─── GET /sessions/patient/:patientId ─────────────────────────────────

  describe('GET /api/transcriptions/sessions/patient/:patientId', () => {
    it('returns sessions for a patient', async () => {
      mockTranscriptionService.findSessionsByPatientId.mockResolvedValueOnce([
        MOCK_SESSION,
      ]);

      const res = await request(app)
        .get('/api/transcriptions/sessions/patient/patient-1')
        .set('x-test-role', 'provider');

      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(1);
    });

    it('logs audit with patient ID and count', async () => {
      mockTranscriptionService.findSessionsByPatientId.mockResolvedValueOnce([
        MOCK_SESSION,
      ]);

      await request(app)
        .get('/api/transcriptions/sessions/patient/patient-1')
        .set('x-test-role', 'provider');

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'view',
          resourceType: 'transcription_session',
          patientId: 'patient-1',
          details: { count: 1 },
        })
      );
    });
  });

  // ─── POST /sessions/:id/generate ──────────────────────────────────────

  describe('POST /api/transcriptions/sessions/:id/generate', () => {
    it('generates a note and returns 201', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce({
        ...MOCK_SESSION,
        status: 'recording',
      });
      mockTranscriptionService.generateNote.mockResolvedValueOnce(MOCK_NOTE);

      const res = await request(app)
        .post('/api/transcriptions/sessions/session-1/generate')
        .set('x-test-role', 'provider')
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.note).toBeDefined();
    });

    it('returns 400 when session is already completed', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce({
        ...MOCK_SESSION,
        status: 'completed',
      });

      const res = await request(app)
        .post('/api/transcriptions/sessions/session-1/generate')
        .set('x-test-role', 'provider')
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 404 for nonexistent session', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/transcriptions/sessions/nonexistent/generate')
        .set('x-test-role', 'provider')
        .send({});

      expect(res.status).toBe(404);
    });
  });

  // ─── POST /sessions/:id/accept ────────────────────────────────────────

  describe('POST /api/transcriptions/sessions/:id/accept', () => {
    it('accepts a note and returns encounter', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce(MOCK_SESSION);
      mockTranscriptionService.acceptNote.mockResolvedValueOnce({
        encounter: { id: 'encounter-1' },
      });

      const res = await request(app)
        .post('/api/transcriptions/sessions/session-1/accept')
        .set('x-test-role', 'provider')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.encounter).toBeDefined();
    });

    it('returns 403 when non-provider accepts', async () => {
      const res = await request(app)
        .post('/api/transcriptions/sessions/session-1/accept')
        .set('x-test-role', 'nurse')
        .send({});

      expect(res.status).toBe(403);
    });

    it('returns 403 when different provider tries to accept', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce({
        ...MOCK_SESSION,
        providerId: 'other-provider',
      });

      const res = await request(app)
        .post('/api/transcriptions/sessions/session-1/accept')
        .set('x-test-role', 'provider')
        .set('x-test-user-id', 'provider-1')
        .send({});

      expect(res.status).toBe(403);
    });

    it('logs audit with acceptance details', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce(MOCK_SESSION);
      mockTranscriptionService.acceptNote.mockResolvedValueOnce({
        encounter: { id: 'encounter-1' },
      });

      await request(app)
        .post('/api/transcriptions/sessions/session-1/accept')
        .set('x-test-role', 'provider')
        .send({ modifications: { subjective: 'Changed' } });

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'create',
          resourceType: 'transcription_note',
          details: expect.objectContaining({
            action: 'accepted',
            hasModifications: true,
          }),
        })
      );
    });
  });

  // ─── POST /sessions/:id/reject ────────────────────────────────────────

  describe('POST /api/transcriptions/sessions/:id/reject', () => {
    it('rejects a note', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce(MOCK_SESSION);
      mockTranscriptionService.rejectNote.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post('/api/transcriptions/sessions/session-1/reject')
        .set('x-test-role', 'provider');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Note rejected');
    });

    it('returns 403 for different provider', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce({
        ...MOCK_SESSION,
        providerId: 'other-provider',
      });

      const res = await request(app)
        .post('/api/transcriptions/sessions/session-1/reject')
        .set('x-test-role', 'provider')
        .set('x-test-user-id', 'provider-1');

      expect(res.status).toBe(403);
    });
  });

  // ─── PUT /sessions/:id/note ────────────────────────────────────────────

  describe('PUT /api/transcriptions/sessions/:id/note', () => {
    it('updates note content', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce(MOCK_SESSION);
      mockTranscriptionService.updateNote.mockResolvedValueOnce({
        ...MOCK_NOTE,
        chiefComplaint: 'Updated',
      });

      const res = await request(app)
        .put('/api/transcriptions/sessions/session-1/note')
        .set('x-test-role', 'provider')
        .send({ chiefComplaint: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.note.chiefComplaint).toBe('Updated');
    });

    it('returns 404 for nonexistent session', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce(null);

      const res = await request(app)
        .put('/api/transcriptions/sessions/nonexistent/note')
        .set('x-test-role', 'provider')
        .send({ chiefComplaint: 'Test' });

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /sessions/:id/note ────────────────────────────────────────────

  describe('GET /api/transcriptions/sessions/:id/note', () => {
    it('returns note for a session', async () => {
      mockTranscriptionService.getSessionWithNote.mockResolvedValueOnce({
        session: MOCK_SESSION,
        note: MOCK_NOTE,
      });

      const res = await request(app)
        .get('/api/transcriptions/sessions/session-1/note')
        .set('x-test-role', 'provider');

      expect(res.status).toBe(200);
      expect(res.body.note).toBeDefined();
    });
  });

  // ─── GET /sessions/:id/codes ──────────────────────────────────────────

  describe('GET /api/transcriptions/sessions/:id/codes', () => {
    it('returns suggested codes', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce(MOCK_SESSION);
      mockTranscriptionService.getSuggestedCodes.mockResolvedValueOnce({
        icdCodes: [{ code: 'J02.9', description: 'Pharyngitis', confidence: 0.92 }],
        cptCodes: [],
      });

      const res = await request(app)
        .get('/api/transcriptions/sessions/session-1/codes')
        .set('x-test-role', 'provider');

      expect(res.status).toBe(200);
      expect(res.body.icdCodes).toHaveLength(1);
    });

    it('allows billing role to view codes', async () => {
      mockTranscriptionService.findSessionById.mockResolvedValueOnce(MOCK_SESSION);
      mockTranscriptionService.getSuggestedCodes.mockResolvedValueOnce({
        icdCodes: [],
        cptCodes: [],
      });

      const res = await request(app)
        .get('/api/transcriptions/sessions/session-1/codes')
        .set('x-test-role', 'billing');

      expect(res.status).toBe(200);
    });

    it('returns 403 for secretary role', async () => {
      const res = await request(app)
        .get('/api/transcriptions/sessions/session-1/codes')
        .set('x-test-role', 'secretary');

      expect(res.status).toBe(403);
    });
  });

  // ─── Template Endpoints ──────────────────────────────────────────────────

  describe('GET /api/transcriptions/templates', () => {
    it('returns templates for current provider', async () => {
      mockTranscriptionService.findTemplatesByProviderId.mockResolvedValueOnce([MOCK_TEMPLATE]);

      const res = await request(app)
        .get('/api/transcriptions/templates')
        .set('x-test-role', 'provider');

      expect(res.status).toBe(200);
      expect(res.body.templates).toHaveLength(1);
    });
  });

  describe('POST /api/transcriptions/templates', () => {
    it('creates a template and returns 201', async () => {
      mockTranscriptionService.createTemplate.mockResolvedValueOnce(MOCK_TEMPLATE);

      const res = await request(app)
        .post('/api/transcriptions/templates')
        .set('x-test-role', 'provider')
        .send({
          name: 'My SOAP',
          templateType: 'soap',
          sections: [],
        });

      expect(res.status).toBe(201);
      expect(res.body.template).toBeDefined();
    });

    it('returns 403 for non-provider roles', async () => {
      const res = await request(app)
        .post('/api/transcriptions/templates')
        .set('x-test-role', 'nurse')
        .send({ name: 'Test', templateType: 'soap', sections: [] });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/transcriptions/templates/:id', () => {
    it('updates a template', async () => {
      mockTranscriptionService.findTemplateById.mockResolvedValueOnce(MOCK_TEMPLATE);
      mockTranscriptionService.updateTemplate.mockResolvedValueOnce({
        ...MOCK_TEMPLATE,
        name: 'Updated',
      });

      const res = await request(app)
        .put('/api/transcriptions/templates/template-1')
        .set('x-test-role', 'provider')
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
    });

    it('returns 403 when modifying another providers template', async () => {
      mockTranscriptionService.findTemplateById.mockResolvedValueOnce({
        ...MOCK_TEMPLATE,
        providerId: 'other-provider',
      });

      const res = await request(app)
        .put('/api/transcriptions/templates/template-1')
        .set('x-test-role', 'provider')
        .set('x-test-user-id', 'provider-1')
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/transcriptions/templates/:id', () => {
    it('deletes a template and returns 204', async () => {
      mockTranscriptionService.findTemplateById.mockResolvedValueOnce(MOCK_TEMPLATE);
      mockTranscriptionService.deleteTemplate.mockResolvedValueOnce(true);

      const res = await request(app)
        .delete('/api/transcriptions/templates/template-1')
        .set('x-test-role', 'provider');

      expect(res.status).toBe(204);
    });

    it('returns 404 for nonexistent template', async () => {
      mockTranscriptionService.findTemplateById.mockResolvedValueOnce(null);

      const res = await request(app)
        .delete('/api/transcriptions/templates/nonexistent')
        .set('x-test-role', 'provider');

      expect(res.status).toBe(404);
    });
  });

  // ─── Consent Endpoints ────────────────────────────────────────────────────

  describe('POST /api/transcriptions/consent', () => {
    it('records consent and returns 201', async () => {
      mockTranscriptionService.recordConsent.mockResolvedValueOnce({
        id: 'consent-1',
        patientId: 'patient-1',
        consentGiven: true,
        consentMethod: 'verbal',
      });

      const res = await request(app)
        .post('/api/transcriptions/consent')
        .set('x-test-role', 'provider')
        .send({
          patientId: 'patient-1',
          consentGiven: true,
          consentMethod: 'verbal',
        });

      expect(res.status).toBe(201);
      expect(res.body.consent.consentGiven).toBe(true);
    });

    it('logs consent audit with HIPAA-required details', async () => {
      mockTranscriptionService.recordConsent.mockResolvedValueOnce({
        id: 'consent-1',
        patientId: 'patient-1',
        consentGiven: true,
        consentMethod: 'verbal',
      });

      await request(app)
        .post('/api/transcriptions/consent')
        .set('x-test-role', 'provider')
        .send({
          patientId: 'patient-1',
          consentGiven: true,
          consentMethod: 'verbal',
        });

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'create',
          resourceType: 'transcription_consent',
          patientId: 'patient-1',
          details: expect.objectContaining({
            consentGiven: true,
            method: 'verbal',
          }),
        })
      );
    });
  });

  describe('GET /api/transcriptions/consent/patient/:patientId', () => {
    it('returns consent history', async () => {
      mockTranscriptionService.findConsentsByPatientId.mockResolvedValueOnce([
        { id: 'consent-1', consentGiven: true, consentMethod: 'verbal' },
      ]);

      const res = await request(app)
        .get('/api/transcriptions/consent/patient/patient-1')
        .set('x-test-role', 'provider');

      expect(res.status).toBe(200);
      expect(res.body.consents).toHaveLength(1);
    });

    it('logs audit for consent history view', async () => {
      mockTranscriptionService.findConsentsByPatientId.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/transcriptions/consent/patient/patient-1')
        .set('x-test-role', 'nurse');

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'view',
          resourceType: 'transcription_consent',
          patientId: 'patient-1',
        })
      );
    });
  });
});
