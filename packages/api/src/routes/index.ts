import { Router } from 'express';
import authRoutes from './auth.js';
import patientRoutes from './patients.js';
import encounterRoutes from './encounters.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/encounters', encounterRoutes);

export default router;
