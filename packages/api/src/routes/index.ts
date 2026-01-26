import { Router } from 'express';
import authRoutes from './auth.js';
import patientRoutes from './patients.js';
import encounterRoutes from './encounters.js';
import documentRoutes from './documents.js';
import appointmentRoutes from './appointments.js';
import ocrRoutes from './ocr.js';
import referralRoutes from './referrals.js';
import calendarRoutes from './calendar.js';
import taskRoutes from './tasks.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/encounters', encounterRoutes);
router.use('/documents', documentRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/ocr', ocrRoutes);
router.use('/referrals', referralRoutes);
router.use('/calendar', calendarRoutes);
router.use('/tasks', taskRoutes);

export default router;
