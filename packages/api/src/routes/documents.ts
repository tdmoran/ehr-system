import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import * as documentService from '../services/document.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
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

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
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
  },
});

router.use(authenticate);

// Get documents for a patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const documents = await documentService.findByPatientId(req.params.patientId);

    await logAudit(req, {
      action: 'view',
      resourceType: 'document',
      patientId: req.params.patientId,
      details: { count: documents.length },
    });

    res.json({ documents });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload a document
router.post(
  '/patient/:patientId',
  authorize('provider', 'nurse', 'admin', 'secretary'),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const document = await documentService.create({
        patientId: req.params.patientId,
        uploadedBy: req.user!.id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        description: req.body.description,
        category: req.body.category || 'scanned_document',
      });

      await logAudit(req, {
        action: 'create',
        resourceType: 'document',
        resourceId: document.id,
        patientId: req.params.patientId,
        details: { filename: document.originalName },
      });

      res.status(201).json({ document });
    } catch (error) {
      console.error('Upload document error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Download a document
router.get('/:id/download', async (req, res) => {
  try {
    const document = await documentService.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = path.join(uploadsDir, document.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    await logAudit(req, {
      action: 'view',
      resourceType: 'document',
      resourceId: document.id,
      patientId: document.patientId,
      details: { filename: document.originalName },
    });

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${document.originalName}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a document
router.delete('/:id', authorize('provider', 'admin'), async (req, res) => {
  try {
    const document = await documentService.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete the file
    const filePath = path.join(uploadsDir, document.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete the database record
    await documentService.remove(req.params.id);

    await logAudit(req, {
      action: 'delete',
      resourceType: 'document',
      resourceId: req.params.id,
      patientId: document.patientId,
      details: { filename: document.originalName },
    });

    res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
