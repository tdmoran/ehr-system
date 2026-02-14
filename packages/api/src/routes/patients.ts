import { Router } from 'express';
import { z } from 'zod';
import * as patientService from '../services/patient.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';
import { asyncHandler, NotFoundError, ConflictError } from '../errors/index.js';

const router = Router();

router.use(authenticate);

const createPatientSchema = z.object({
  mrn: z.string().min(1).max(50),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  addressLine1: z.string().max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zip: z.string().max(20).optional(),
  emergencyContactName: z.string().max(200).optional(),
  emergencyContactPhone: z.string().max(20).optional(),
  insuranceProvider: z.string().max(200).optional(),
  insuranceId: z.string().max(100).optional(),
  notes: z.string().optional(),
  clinicNotes: z.string().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const search = req.query.search as string;

  const patients = search
    ? await patientService.search(search, limit)
    : await patientService.findAll(limit, offset);

  res.json({ patients });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const patient = await patientService.findById(req.params.id);
  if (!patient) throw new NotFoundError('Patient not found');

  await logAudit(req, {
    action: 'view',
    resourceType: 'patient',
    resourceId: patient.id,
    patientId: patient.id,
  });

  res.json({ patient });
}));

router.post('/', authorize('provider', 'nurse', 'admin'), validate(createPatientSchema), asyncHandler(async (req, res) => {
  const existingPatient = await patientService.findByMrn(req.body.mrn);
  if (existingPatient) throw new ConflictError('Patient with this MRN already exists');

  const patient = await patientService.create(req.body);

  await logAudit(req, {
    action: 'create',
    resourceType: 'patient',
    resourceId: patient.id,
    patientId: patient.id,
  });

  res.status(201).json({ patient });
}));

router.put('/:id', authorize('provider', 'nurse', 'admin'), validate(createPatientSchema.partial()), asyncHandler(async (req, res) => {
  const patient = await patientService.update(req.params.id, req.body);
  if (!patient) throw new NotFoundError('Patient not found');

  await logAudit(req, {
    action: 'update',
    resourceType: 'patient',
    resourceId: patient.id,
    patientId: patient.id,
    details: { updatedFields: Object.keys(req.body) },
  });

  res.json({ patient });
}));

router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const success = await patientService.deactivate(req.params.id);
  if (!success) throw new NotFoundError('Patient not found');

  await logAudit(req, {
    action: 'delete',
    resourceType: 'patient',
    resourceId: req.params.id,
    patientId: req.params.id,
  });

  res.json({ message: 'Patient deactivated' });
}));

export default router;
