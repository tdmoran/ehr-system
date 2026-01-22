import { Router } from 'express';
import { z } from 'zod';
import * as patientService from '../services/patient.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';

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
});

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = req.query.search as string;

    let patients;
    if (search) {
      patients = await patientService.search(search, limit);
    } else {
      patients = await patientService.findAll(limit, offset);
    }

    res.json({ patients });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const patient = await patientService.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    await logAudit(req, {
      action: 'view',
      resourceType: 'patient',
      resourceId: patient.id,
      patientId: patient.id,
    });

    res.json({ patient });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authorize('provider', 'nurse', 'admin'), validate(createPatientSchema), async (req, res) => {
  try {
    const existingPatient = await patientService.findByMrn(req.body.mrn);
    if (existingPatient) {
      return res.status(409).json({ error: 'Patient with this MRN already exists' });
    }

    const patient = await patientService.create(req.body);

    await logAudit(req, {
      action: 'create',
      resourceType: 'patient',
      resourceId: patient.id,
      patientId: patient.id,
    });

    res.status(201).json({ patient });
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authorize('provider', 'nurse', 'admin'), validate(createPatientSchema.partial()), async (req, res) => {
  try {
    const patient = await patientService.update(req.params.id, req.body);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    await logAudit(req, {
      action: 'update',
      resourceType: 'patient',
      resourceId: patient.id,
      patientId: patient.id,
      details: { updatedFields: Object.keys(req.body) },
    });

    res.json({ patient });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const success = await patientService.deactivate(req.params.id);

    if (!success) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    await logAudit(req, {
      action: 'delete',
      resourceType: 'patient',
      resourceId: req.params.id,
      patientId: req.params.id,
    });

    res.json({ message: 'Patient deactivated' });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
