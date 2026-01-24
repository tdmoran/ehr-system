import { Router } from 'express';
import * as appointmentService from '../services/appointment.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();

router.use(authenticate);

// Get appointments for a date range
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, providerId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const appointments = await appointmentService.findByDateRange(
      startDate as string,
      endDate as string,
      providerId as string | undefined
    );

    await logAudit(req, {
      action: 'view',
      resourceType: 'appointment',
      details: { startDate, endDate, count: appointments.length },
    });

    res.json({ appointments });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single appointment
router.get('/:id', async (req, res) => {
  try {
    const appointment = await appointmentService.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    await logAudit(req, {
      action: 'view',
      resourceType: 'appointment',
      resourceId: appointment.id,
      patientId: appointment.patientId,
    });

    res.json({ appointment });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create appointment
router.post('/', authorize('provider', 'nurse', 'admin', 'secretary'), async (req, res) => {
  try {
    const { patientId, providerId, appointmentDate, startTime, endTime, appointmentType, reason, notes } = req.body;

    if (!patientId || !providerId || !appointmentDate || !startTime || !endTime || !appointmentType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

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
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update appointment
router.put('/:id', authorize('provider', 'nurse', 'admin', 'secretary'), async (req, res) => {
  try {
    const appointment = await appointmentService.update(req.params.id, req.body);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    await logAudit(req, {
      action: 'update',
      resourceType: 'appointment',
      resourceId: appointment.id,
      patientId: appointment.patientId,
      details: req.body,
    });

    res.json({ appointment });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete appointment
router.delete('/:id', authorize('provider', 'admin', 'secretary'), async (req, res) => {
  try {
    const appointment = await appointmentService.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    await appointmentService.remove(req.params.id);

    await logAudit(req, {
      action: 'delete',
      resourceType: 'appointment',
      resourceId: req.params.id,
      patientId: appointment.patientId,
    });

    res.json({ message: 'Appointment deleted' });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk create appointments
router.post('/bulk', authorize('provider', 'nurse', 'admin', 'secretary'), async (req, res) => {
  try {
    const { appointments } = req.body;

    if (!Array.isArray(appointments) || appointments.length === 0) {
      return res.status(400).json({ error: 'appointments array is required' });
    }

    const createdAppointments = [];
    const errors = [];

    for (let i = 0; i < appointments.length; i++) {
      const appt = appointments[i];
      const { patientId, providerId, appointmentDate, startTime, endTime, appointmentType, reason, notes } = appt;

      if (!patientId || !providerId || !appointmentDate || !startTime || !endTime || !appointmentType) {
        errors.push({ index: i, error: 'Missing required fields' });
        continue;
      }

      try {
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
  } catch (error) {
    console.error('Bulk create appointments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get appointment types
router.get('/config/types', async (req, res) => {
  try {
    const types = await appointmentService.getAppointmentTypes();
    res.json({ types });
  } catch (error) {
    console.error('Get appointment types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get providers list
router.get('/config/providers', async (req, res) => {
  try {
    const providers = await appointmentService.getProviders();
    res.json({ providers });
  } catch (error) {
    console.error('Get providers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
