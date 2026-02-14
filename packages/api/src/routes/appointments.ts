import { Router } from 'express';
import { z } from 'zod';
import * as appointmentService from '../services/appointment.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { asyncHandler, NotFoundError } from '../errors/index.js';

const router = Router();

router.use(authenticate);

// --- Schemas ---

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;

const getAppointmentsQuery = z.object({
  startDate: z.string().regex(dateRegex, 'startDate must be YYYY-MM-DD'),
  endDate: z.string().regex(dateRegex, 'endDate must be YYYY-MM-DD'),
  providerId: z.string().uuid().optional(),
});

const createAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  providerId: z.string().uuid(),
  appointmentDate: z.string().regex(dateRegex, 'appointmentDate must be YYYY-MM-DD'),
  startTime: z.string().regex(timeRegex, 'startTime must be HH:MM'),
  endTime: z.string().regex(timeRegex, 'endTime must be HH:MM'),
  appointmentType: z.string().min(1).max(100),
  reason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

const updateAppointmentSchema = z.object({
  patientId: z.string().uuid().optional(),
  providerId: z.string().uuid().optional(),
  appointmentDate: z.string().regex(dateRegex).optional(),
  startTime: z.string().regex(timeRegex).optional(),
  endTime: z.string().regex(timeRegex).optional(),
  appointmentType: z.string().min(1).max(100).optional(),
  status: z.enum(['scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
  reason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

const bulkCreateSchema = z.object({
  appointments: z.array(createAppointmentSchema).min(1).max(50),
});

// --- Routes ---

// Get appointments for a date range
router.get('/', validateQuery(getAppointmentsQuery), asyncHandler(async (req, res) => {
  const { startDate, endDate, providerId } = req.query as z.infer<typeof getAppointmentsQuery>;

  const appointments = await appointmentService.findByDateRange(
    startDate,
    endDate,
    providerId
  );

  await logAudit(req, {
    action: 'view',
    resourceType: 'appointment',
    details: { startDate, endDate, count: appointments.length },
  });

  res.json({ appointments });
}));

// Get single appointment
router.get('/:id', asyncHandler(async (req, res) => {
  const appointment = await appointmentService.findById(req.params.id);
  if (!appointment) throw new NotFoundError('Appointment not found');

  await logAudit(req, {
    action: 'view',
    resourceType: 'appointment',
    resourceId: appointment.id,
    patientId: appointment.patientId,
  });

  res.json({ appointment });
}));

// Create appointment
router.post('/', authorize('provider', 'nurse', 'admin', 'secretary'), validate(createAppointmentSchema), asyncHandler(async (req, res) => {
  const { patientId, providerId, appointmentDate, startTime, endTime, appointmentType, reason, notes } = req.body;

  const appointment = await appointmentService.create({
    patientId,
    providerId,
    appointmentDate,
    startTime,
    endTime,
    appointmentType,
    reason,
    notes,
    createdBy: req.user!.id,
  });

  await logAudit(req, {
    action: 'create',
    resourceType: 'appointment',
    resourceId: appointment.id,
    patientId: appointment.patientId,
    details: { appointmentDate, appointmentType },
  });

  res.status(201).json({ appointment });
}));

// Update appointment
router.put('/:id', authorize('provider', 'nurse', 'admin', 'secretary'), validate(updateAppointmentSchema), asyncHandler(async (req, res) => {
  const appointment = await appointmentService.update(req.params.id, req.body);
  if (!appointment) throw new NotFoundError('Appointment not found');

  await logAudit(req, {
    action: 'update',
    resourceType: 'appointment',
    resourceId: appointment.id,
    patientId: appointment.patientId,
    details: req.body,
  });

  res.json({ appointment });
}));

// Delete appointment
router.delete('/:id', authorize('provider', 'admin', 'secretary'), asyncHandler(async (req, res) => {
  const appointment = await appointmentService.findById(req.params.id);
  if (!appointment) throw new NotFoundError('Appointment not found');

  await appointmentService.remove(req.params.id);

  await logAudit(req, {
    action: 'delete',
    resourceType: 'appointment',
    resourceId: req.params.id,
    patientId: appointment.patientId,
  });

  res.json({ message: 'Appointment deleted' });
}));

// Bulk create appointments
router.post('/bulk', authorize('provider', 'nurse', 'admin', 'secretary'), validate(bulkCreateSchema), asyncHandler(async (req, res) => {
  const { appointments } = req.body as z.infer<typeof bulkCreateSchema>;

  const createdAppointments = [];
  const errors = [];

  for (let i = 0; i < appointments.length; i++) {
    const appt = appointments[i];
    try {
      const appointment = await appointmentService.create({
        ...appt,
        createdBy: req.user!.id,
      });
      createdAppointments.push(appointment);
    } catch (err) {
      errors.push({ index: i, error: 'Failed to create appointment' });
    }
  }

  await logAudit(req, {
    action: 'bulk_create',
    resourceType: 'appointment',
    details: { count: createdAppointments.length, errors: errors.length },
  });

  res.status(201).json({ appointments: createdAppointments, errors });
}));

// Get appointment types
router.get('/config/types', asyncHandler(async (req, res) => {
  const types = await appointmentService.getAppointmentTypes();
  res.json({ types });
}));

// Get providers list
router.get('/config/providers', asyncHandler(async (req, res) => {
  const providers = await appointmentService.getProviders();
  res.json({ providers });
}));

export default router;
