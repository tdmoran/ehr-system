import { Router } from 'express';
import { z } from 'zod';
import * as encounterService from '../services/encounter.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';
import { asyncHandler, NotFoundError, BadRequestError, ForbiddenError } from '../errors/index.js';

const router = Router();

router.use(authenticate);

const createEncounterSchema = z.object({
  patientId: z.string().uuid(),
  providerId: z.string().uuid().optional(),
  encounterDate: z.string().datetime().optional(),
  chiefComplaint: z.string().max(1000).optional(),
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
});

router.get('/patient/:patientId', asyncHandler(async (req, res) => {
  const encounters = await encounterService.findByPatientId(req.params.patientId);

  await logAudit(req, {
    action: 'view',
    resourceType: 'encounter',
    patientId: req.params.patientId,
    details: { count: encounters.length },
  });

  res.json({ encounters });
}));

router.get('/:id', authorize('provider', 'nurse', 'admin'), asyncHandler(async (req, res) => {
  const encounter = await encounterService.findById(req.params.id);
  if (!encounter) throw new NotFoundError('Encounter not found');

  await logAudit(req, {
    action: 'view',
    resourceType: 'encounter',
    resourceId: encounter.id,
    patientId: encounter.patientId,
  });

  res.json({ encounter });
}));

router.post('/', authorize('provider', 'nurse'), validate(createEncounterSchema), asyncHandler(async (req, res) => {
  const encounter = await encounterService.create({
    ...req.body,
    providerId: req.body.providerId || req.user!.id,
  });

  await logAudit(req, {
    action: 'create',
    resourceType: 'encounter',
    resourceId: encounter.id,
    patientId: encounter.patientId,
  });

  res.status(201).json({ encounter });
}));

router.put('/:id', authorize('provider', 'nurse'), validate(createEncounterSchema.partial()), asyncHandler(async (req, res) => {
  const existing = await encounterService.findById(req.params.id);
  if (!existing) throw new NotFoundError('Encounter not found');
  if (existing.status === 'signed') throw new BadRequestError('Cannot modify a signed encounter');

  const encounter = await encounterService.update(req.params.id, req.body);

  await logAudit(req, {
    action: 'update',
    resourceType: 'encounter',
    resourceId: req.params.id,
    patientId: existing.patientId,
    details: { updatedFields: Object.keys(req.body) },
  });

  res.json({ encounter });
}));

router.post('/:id/sign', authorize('provider'), asyncHandler(async (req, res) => {
  const existing = await encounterService.findById(req.params.id);
  if (!existing) throw new NotFoundError('Encounter not found');
  if (existing.providerId !== req.user!.id) throw new ForbiddenError('Only the encounter provider can sign');

  const encounter = await encounterService.sign(req.params.id);

  await logAudit(req, {
    action: 'update',
    resourceType: 'encounter',
    resourceId: req.params.id,
    patientId: existing.patientId,
    details: { action: 'signed' },
  });

  res.json({ encounter });
}));

export default router;
