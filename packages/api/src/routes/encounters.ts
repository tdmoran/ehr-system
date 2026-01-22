import { Router } from 'express';
import { z } from 'zod';
import * as encounterService from '../services/encounter.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();

router.use(authenticate);

const vitalsSchema = z.object({
  bp: z.string().optional(),
  hr: z.number().optional(),
  temp: z.number().optional(),
  weight: z.number().optional(),
  height: z.number().optional(),
  respiratoryRate: z.number().optional(),
  oxygenSaturation: z.number().optional(),
});

const createEncounterSchema = z.object({
  patientId: z.string().uuid(),
  providerId: z.string().uuid().optional(),
  encounterDate: z.string().datetime().optional(),
  chiefComplaint: z.string().max(1000).optional(),
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  vitals: vitalsSchema.optional(),
  diagnosisCodes: z.array(z.string()).optional(),
});

router.get('/patient/:patientId', async (req, res) => {
  try {
    const encounters = await encounterService.findByPatientId(req.params.patientId);

    await logAudit(req, {
      action: 'view',
      resourceType: 'encounter',
      patientId: req.params.patientId,
      details: { count: encounters.length },
    });

    res.json({ encounters });
  } catch (error) {
    console.error('Get encounters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const encounter = await encounterService.findById(req.params.id);

    if (!encounter) {
      return res.status(404).json({ error: 'Encounter not found' });
    }

    await logAudit(req, {
      action: 'view',
      resourceType: 'encounter',
      resourceId: encounter.id,
      patientId: encounter.patientId,
    });

    res.json({ encounter });
  } catch (error) {
    console.error('Get encounter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authorize('provider', 'nurse'), validate(createEncounterSchema), async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Create encounter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authorize('provider', 'nurse'), validate(createEncounterSchema.partial()), async (req, res) => {
  try {
    const existing = await encounterService.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Encounter not found' });
    }

    if (existing.status === 'signed') {
      return res.status(400).json({ error: 'Cannot modify a signed encounter' });
    }

    const encounter = await encounterService.update(req.params.id, req.body);

    await logAudit(req, {
      action: 'update',
      resourceType: 'encounter',
      resourceId: req.params.id,
      patientId: existing.patientId,
      details: { updatedFields: Object.keys(req.body) },
    });

    res.json({ encounter });
  } catch (error) {
    console.error('Update encounter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/sign', authorize('provider'), async (req, res) => {
  try {
    const existing = await encounterService.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Encounter not found' });
    }

    if (existing.providerId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the encounter provider can sign' });
    }

    const encounter = await encounterService.sign(req.params.id);

    await logAudit(req, {
      action: 'update',
      resourceType: 'encounter',
      resourceId: req.params.id,
      patientId: existing.patientId,
      details: { action: 'signed' },
    });

    res.json({ encounter });
  } catch (error) {
    console.error('Sign encounter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
