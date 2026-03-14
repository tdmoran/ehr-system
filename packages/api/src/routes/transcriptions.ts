import { Router } from 'express';
import { z } from 'zod';
import * as transcriptionService from '../services/transcription.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';
import { asyncHandler, NotFoundError, BadRequestError, ForbiddenError } from '../errors/index.js';
import { config } from '../config/index.js';

const router = Router();

router.use(authenticate);

// ─── Feature flag guard ──────────────────────────────────────────────────────

function requireAITranscriptionEnabled() {
  return asyncHandler(async (_req, res, next) => {
    if (!config.aiTranscription.enabled) {
      return res.status(503).json({ error: 'Transcription feature is not enabled' });
    }
    next();
  });
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createSessionSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  templateType: z.enum(['soap', 'progress_note', 'referral_letter', 'operative_note', 'assessment_report', 'custom']).optional(),
  language: z.string().max(10).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['recording', 'processing', 'cancelled']),
});

const generateNoteSchema = z.object({
  templateType: z.enum(['soap', 'progress_note', 'referral_letter', 'operative_note', 'assessment_report', 'custom']).optional(),
});

const acceptNoteSchema = z.object({
  modifications: z.record(z.unknown()).optional(),
  encounterId: z.string().uuid().optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  templateType: z.enum(['soap', 'progress_note', 'referral_letter', 'operative_note', 'assessment_report', 'custom']),
  sections: z.array(z.object({
    name: z.string(),
    prompt: z.string(),
    required: z.boolean(),
  })),
  isDefault: z.boolean().optional(),
});

const updateTemplateSchema = createTemplateSchema.partial();

const recordConsentSchema = z.object({
  patientId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  consentGiven: z.boolean(),
  consentMethod: z.enum(['verbal', 'written', 'electronic']),
  notes: z.string().max(1000).optional(),
});

// ─── Session Endpoints ───────────────────────────────────────────────────────

// POST /sessions — Create a new transcription session
router.post(
  '/sessions',
  requireAITranscriptionEnabled(),
  authorize('provider', 'nurse'),
  validate(createSessionSchema),
  asyncHandler(async (req, res) => {
    const { session, externalSessionUrl } = await transcriptionService.createSession({
      ...req.body,
      providerId: req.user!.id,
    });

    await logAudit(req, {
      action: 'create',
      resourceType: 'transcription_session',
      resourceId: session.id,
      patientId: session.patientId,
    });

    res.status(201).json({ session, externalSessionUrl });
  })
);

// PATCH /sessions/:id/status — Update session status
router.patch(
  '/sessions/:id/status',
  requireAITranscriptionEnabled(),
  authorize('provider', 'nurse'),
  validate(updateStatusSchema),
  asyncHandler(async (req, res) => {
    const existing = await transcriptionService.findSessionById(req.params.id);
    if (!existing) throw new NotFoundError('Transcription session not found');

    if (existing.providerId !== req.user!.id && req.user!.role !== 'admin') {
      throw new ForbiddenError('Cannot modify another provider\'s session');
    }

    const session = await transcriptionService.updateSessionStatus(req.params.id, req.body.status);

    await logAudit(req, {
      action: 'update',
      resourceType: 'transcription_session',
      resourceId: req.params.id,
      patientId: existing.patientId,
      details: { status: req.body.status },
    });

    res.json({ session });
  })
);

// GET /sessions/:id — Get session details with note
router.get(
  '/sessions/:id',
  authorize('provider', 'nurse', 'admin'),
  asyncHandler(async (req, res) => {
    const result = await transcriptionService.getSessionWithNote(req.params.id);
    if (!result) throw new NotFoundError('Transcription session not found');

    await logAudit(req, {
      action: 'view',
      resourceType: 'transcription_session',
      resourceId: req.params.id,
      patientId: result.session.patientId,
    });

    res.json(result);
  })
);

// GET /sessions/patient/:patientId — List sessions for a patient
router.get(
  '/sessions/patient/:patientId',
  authorize('provider', 'nurse', 'admin'),
  asyncHandler(async (req, res) => {
    const sessions = await transcriptionService.findSessionsByPatientId(req.params.patientId);

    await logAudit(req, {
      action: 'view',
      resourceType: 'transcription_session',
      patientId: req.params.patientId,
      details: { count: sessions.length },
    });

    res.json({ sessions });
  })
);

// POST /sessions/:id/generate — Trigger note generation
router.post(
  '/sessions/:id/generate',
  requireAITranscriptionEnabled(),
  authorize('provider', 'nurse'),
  validate(generateNoteSchema),
  asyncHandler(async (req, res) => {
    const existing = await transcriptionService.findSessionById(req.params.id);
    if (!existing) throw new NotFoundError('Transcription session not found');

    if (existing.status === 'completed') {
      throw new BadRequestError('Note has already been generated for this session');
    }

    const note = await transcriptionService.generateNote(req.params.id, req.body.templateType);

    await logAudit(req, {
      action: 'create',
      resourceType: 'transcription_note',
      resourceId: note.id,
      patientId: existing.patientId,
      details: { sessionId: req.params.id },
    });

    res.status(201).json({ note });
  })
);

// POST /sessions/:id/accept — Accept AI note and create/update encounter
router.post(
  '/sessions/:id/accept',
  authorize('provider'),
  validate(acceptNoteSchema),
  asyncHandler(async (req, res) => {
    const existing = await transcriptionService.findSessionById(req.params.id);
    if (!existing) throw new NotFoundError('Transcription session not found');

    if (existing.providerId !== req.user!.id) {
      throw new ForbiddenError('Only the session provider can accept notes');
    }

    const result = await transcriptionService.acceptNote(
      req.params.id,
      req.user!.id,
      req.body.modifications,
      req.body.encounterId
    );

    await logAudit(req, {
      action: 'create',
      resourceType: 'transcription_note',
      resourceId: req.params.id,
      patientId: existing.patientId,
      details: { action: 'accepted', hasModifications: !!req.body.modifications },
    });

    res.json(result);
  })
);

// POST /sessions/:id/reject — Reject AI note
router.post(
  '/sessions/:id/reject',
  authorize('provider'),
  asyncHandler(async (req, res) => {
    const existing = await transcriptionService.findSessionById(req.params.id);
    if (!existing) throw new NotFoundError('Transcription session not found');

    if (existing.providerId !== req.user!.id) {
      throw new ForbiddenError('Only the session provider can reject notes');
    }

    await transcriptionService.rejectNote(req.params.id, req.user!.id);

    await logAudit(req, {
      action: 'update',
      resourceType: 'transcription_note',
      resourceId: req.params.id,
      patientId: existing.patientId,
      details: { action: 'rejected' },
    });

    res.json({ message: 'Note rejected' });
  })
);

// PUT /sessions/:id/note — Update note content (draft save)
const updateNoteSchema = z.object({
  chiefComplaint: z.string().optional(),
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  summary: z.string().optional(),
  reviewStatus: z.enum(['draft', 'finalized']).optional(),
});

router.put(
  '/sessions/:id/note',
  authorize('provider', 'nurse'),
  validate(updateNoteSchema),
  asyncHandler(async (req, res) => {
    const existing = await transcriptionService.findSessionById(req.params.id);
    if (!existing) throw new NotFoundError('Transcription session not found');

    if (existing.providerId !== req.user!.id && req.user!.role !== 'admin') {
      throw new ForbiddenError('Cannot modify another provider\'s note');
    }

    const note = await transcriptionService.updateNote(req.params.id, req.body);

    await logAudit(req, {
      action: 'update',
      resourceType: 'transcription_note',
      resourceId: req.params.id,
      patientId: existing.patientId,
      details: { updatedFields: Object.keys(req.body), reviewStatus: req.body.reviewStatus },
    });

    res.json({ note });
  })
);

// GET /sessions/:id/note — Get note for a session
router.get(
  '/sessions/:id/note',
  authorize('provider', 'nurse', 'admin'),
  asyncHandler(async (req, res) => {
    const result = await transcriptionService.getSessionWithNote(req.params.id);
    if (!result) throw new NotFoundError('Transcription session not found');

    await logAudit(req, {
      action: 'view',
      resourceType: 'transcription_note',
      resourceId: req.params.id,
      patientId: result.session.patientId,
    });

    res.json({ note: result.note });
  })
);

// GET /sessions/:id/codes — Get suggested ICD-10/CPT codes
router.get(
  '/sessions/:id/codes',
  authorize('provider', 'nurse', 'admin', 'billing'),
  asyncHandler(async (req, res) => {
    const existing = await transcriptionService.findSessionById(req.params.id);
    if (!existing) throw new NotFoundError('Transcription session not found');

    const codes = await transcriptionService.getSuggestedCodes(req.params.id);

    await logAudit(req, {
      action: 'view',
      resourceType: 'transcription_note',
      resourceId: req.params.id,
      patientId: existing.patientId,
      details: { action: 'view_codes' },
    });

    res.json(codes);
  })
);

// ─── Template Endpoints ──────────────────────────────────────────────────────

// GET /templates — List templates for current provider
router.get(
  '/templates',
  authorize('provider', 'admin'),
  asyncHandler(async (req, res) => {
    const templates = await transcriptionService.findTemplatesByProviderId(req.user!.id);
    res.json({ templates });
  })
);

// POST /templates — Create custom template
router.post(
  '/templates',
  authorize('provider'),
  validate(createTemplateSchema),
  asyncHandler(async (req, res) => {
    const template = await transcriptionService.createTemplate({
      ...req.body,
      providerId: req.user!.id,
    });

    await logAudit(req, {
      action: 'create',
      resourceType: 'transcription_session',
      resourceId: template.id,
      details: { templateType: template.templateType },
    });

    res.status(201).json({ template });
  })
);

// PUT /templates/:id — Update template
router.put(
  '/templates/:id',
  authorize('provider'),
  validate(updateTemplateSchema),
  asyncHandler(async (req, res) => {
    const existing = await transcriptionService.findTemplateById(req.params.id);
    if (!existing) throw new NotFoundError('Template not found');

    if (existing.providerId !== req.user!.id) {
      throw new ForbiddenError('Cannot modify another provider\'s template');
    }

    const template = await transcriptionService.updateTemplate(req.params.id, req.body);

    await logAudit(req, {
      action: 'update',
      resourceType: 'transcription_session',
      resourceId: req.params.id,
      details: { updatedFields: Object.keys(req.body) },
    });

    res.json({ template });
  })
);

// DELETE /templates/:id — Delete template
router.delete(
  '/templates/:id',
  authorize('provider'),
  asyncHandler(async (req, res) => {
    const existing = await transcriptionService.findTemplateById(req.params.id);
    if (!existing) throw new NotFoundError('Template not found');

    if (existing.providerId !== req.user!.id) {
      throw new ForbiddenError('Cannot delete another provider\'s template');
    }

    await transcriptionService.deleteTemplate(req.params.id);

    await logAudit(req, {
      action: 'delete',
      resourceType: 'transcription_session',
      resourceId: req.params.id,
    });

    res.status(204).send();
  })
);

// ─── Consent Endpoints ──────────────────────────────────────────────────────

// POST /consent — Record patient consent
router.post(
  '/consent',
  authorize('provider', 'nurse'),
  validate(recordConsentSchema),
  asyncHandler(async (req, res) => {
    const consent = await transcriptionService.recordConsent({
      ...req.body,
      providerId: req.user!.id,
    });

    await logAudit(req, {
      action: 'create',
      resourceType: 'transcription_consent',
      resourceId: consent.id,
      patientId: consent.patientId,
      details: { consentGiven: consent.consentGiven, method: consent.consentMethod },
    });

    res.status(201).json({ consent });
  })
);

// GET /consent/patient/:patientId — Get consent history
router.get(
  '/consent/patient/:patientId',
  authorize('provider', 'nurse', 'admin'),
  asyncHandler(async (req, res) => {
    const consents = await transcriptionService.findConsentsByPatientId(req.params.patientId);

    await logAudit(req, {
      action: 'view',
      resourceType: 'transcription_consent',
      patientId: req.params.patientId,
      details: { count: consents.length },
    });

    res.json({ consents });
  })
);

export default router;
