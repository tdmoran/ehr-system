import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import * as referralService from '../services/referral.service.js';
import * as patientService from '../services/patient.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads', 'referrals');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Allow PDF and common image formats (for scanned documents)
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPEG, PNG, and TIFF files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
    files: 10, // Max 10 files per upload
  },
});

router.use(authenticate);

// Upload multiple referral letters for scanning
router.post(
  '/scan',
  authorize('secretary', 'admin', 'nurse'),
  upload.array('files', 10),
  async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const results: { id: string; filename: string; status: string }[] = [];

      // Create referral scans for each file
      for (const file of files) {
        const scan = await referralService.createReferralScan({
          uploadedBy: req.user!.id,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
        });

        results.push({
          id: scan.id,
          filename: file.originalname,
          status: 'pending',
        });

        // Process OCR asynchronously
        const filePath = path.join(uploadsDir, file.filename);
        referralService.processReferralScan(scan.id, filePath, file.mimetype).catch((error) => {
          console.error(`Failed to process referral scan ${scan.id}:`, error);
        });
      }

      await logAudit(req, {
        action: 'create',
        resourceType: 'referral_scan',
        details: { count: files.length, filenames: files.map((f) => f.originalname) },
      });

      res.status(202).json({
        message: `${files.length} referral letter(s) uploaded for processing`,
        referrals: results,
      });
    } catch (error) {
      console.error('Upload referral letters error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get all pending referral scans for review
router.get('/pending', authorize('secretary', 'admin', 'nurse', 'provider'), async (req, res) => {
  try {
    const referrals = await referralService.findPendingReferrals();

    res.json({ referrals });
  } catch (error) {
    console.error('Get pending referrals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single referral scan with OCR data
router.get('/:id', authorize('secretary', 'admin', 'nurse', 'provider'), async (req, res) => {
  try {
    const ocrResult = await referralService.findOcrResultById(req.params.id);

    if (!ocrResult) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    const scan = await referralService.findReferralScanById(ocrResult.referralScanId);

    await logAudit(req, {
      action: 'view',
      resourceType: 'referral_scan',
      resourceId: req.params.id,
    });

    res.json({ referral: { ...ocrResult, scan } });
  } catch (error) {
    console.error('Get referral error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new patient from referral
const createPatientSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
  gender: z.string().max(20).optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  addressLine1: z.string().max(200).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(50).optional().or(z.literal('')),
  zip: z.string().max(20).optional().or(z.literal('')),
  insuranceProvider: z.string().max(100).optional().or(z.literal('')),
  insuranceId: z.string().max(50).optional().or(z.literal('')),
});

router.post(
  '/:id/create-patient',
  authorize('secretary', 'admin', 'nurse'),
  validate(createPatientSchema),
  async (req, res) => {
    try {
      const ocrResult = await referralService.findOcrResultById(req.params.id);

      if (!ocrResult) {
        return res.status(404).json({ error: 'Referral not found' });
      }

      if (ocrResult.resolutionStatus !== 'pending') {
        return res.status(400).json({ error: 'Referral has already been resolved' });
      }

      // Generate a unique MRN
      const mrn = await referralService.generateMrn();

      // Create the patient
      const patient = await patientService.create({
        mrn,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        dateOfBirth: req.body.dateOfBirth,
        gender: req.body.gender,
        phone: req.body.phone,
        email: req.body.email || undefined,
        addressLine1: req.body.addressLine1,
        city: req.body.city,
        state: req.body.state,
        zip: req.body.zip,
        insuranceProvider: req.body.insuranceProvider,
        insuranceId: req.body.insuranceId,
      });

      // Mark referral as resolved with new patient
      await referralService.resolveAsCreated(ocrResult.id, patient.id, req.user!.id);

      await logAudit(req, {
        action: 'create',
        resourceType: 'patient',
        resourceId: patient.id,
        patientId: patient.id,
        details: { fromReferral: ocrResult.id },
      });

      res.status(201).json({
        message: 'Patient created from referral',
        patient,
      });
    } catch (error) {
      console.error('Create patient from referral error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Add referral info to existing patient
const addToPatientSchema = z.object({
  patientId: z.string().uuid(),
  referringPhysician: z.string().max(200).optional(),
  referringFacility: z.string().max(200).optional(),
  reasonForReferral: z.string().optional(),
});

router.post(
  '/:id/add-to-patient',
  authorize('secretary', 'admin', 'nurse'),
  validate(addToPatientSchema),
  async (req, res) => {
    try {
      const ocrResult = await referralService.findOcrResultById(req.params.id);

      if (!ocrResult) {
        return res.status(404).json({ error: 'Referral not found' });
      }

      if (ocrResult.resolutionStatus !== 'pending') {
        return res.status(400).json({ error: 'Referral has already been resolved' });
      }

      // Verify patient exists
      const patient = await patientService.findById(req.body.patientId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      // Mark referral as resolved and added to existing patient
      await referralService.resolveAsAdded(ocrResult.id, patient.id, req.user!.id);

      await logAudit(req, {
        action: 'update',
        resourceType: 'referral_scan',
        resourceId: ocrResult.id,
        patientId: patient.id,
        details: {
          action: 'added_to_existing_patient',
          referringPhysician: req.body.referringPhysician,
          referringFacility: req.body.referringFacility,
        },
      });

      res.json({
        message: 'Referral added to existing patient',
        patient,
      });
    } catch (error) {
      console.error('Add referral to patient error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Skip/dismiss a referral
router.post('/:id/skip', authorize('secretary', 'admin', 'nurse'), async (req, res) => {
  try {
    const ocrResult = await referralService.findOcrResultById(req.params.id);

    if (!ocrResult) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    if (ocrResult.resolutionStatus !== 'pending') {
      return res.status(400).json({ error: 'Referral has already been resolved' });
    }

    await referralService.resolveAsSkipped(ocrResult.id, req.user!.id);

    await logAudit(req, {
      action: 'update',
      resourceType: 'referral_scan',
      resourceId: ocrResult.id,
      details: { action: 'skipped' },
    });

    res.json({ message: 'Referral skipped' });
  } catch (error) {
    console.error('Skip referral error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download the original referral scan file
router.get('/:id/download', authorize('secretary', 'admin', 'nurse', 'provider'), async (req, res) => {
  try {
    const ocrResult = await referralService.findOcrResultById(req.params.id);

    if (!ocrResult) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    const scan = await referralService.findReferralScanById(ocrResult.referralScanId);
    if (!scan) {
      return res.status(404).json({ error: 'Referral scan not found' });
    }

    const filePath = path.join(uploadsDir, scan.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    await logAudit(req, {
      action: 'view',
      resourceType: 'referral_scan',
      resourceId: req.params.id,
      details: { filename: scan.originalName },
    });

    res.setHeader('Content-Type', scan.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${scan.originalName}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Download referral error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
