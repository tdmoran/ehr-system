import { Router } from 'express';
import authRoutes from './auth.js';
import patientRoutes from './patients.js';
import encounterRoutes from './encounters.js';
import documentRoutes from './documents.js';
import appointmentRoutes from './appointments.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/encounters', encounterRoutes);
router.use('/documents', documentRoutes);
router.use('/appointments', appointmentRoutes);

export default router;
