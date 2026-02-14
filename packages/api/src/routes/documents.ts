import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import * as documentService from '../services/document.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { asyncHandler, NotFoundError, BadRequestError } from '../errors/index.js';
import { config } from '../config/index.js';
import { z } from 'zod';

const uploadDocumentBodySchema = z.object({
  description: z.string().max(500).optional(),
  category: z.enum(['scanned_document', 'letter', 'operative_note']).optional().default('scanned_document'),
});

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
  if (config.uploads.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${config.uploads.allowedMimeTypes.join(', ')}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.uploads.maxFileSizeMb * 1024 * 1024,
  },
});

router.use(authenticate);

// Get all documents (with optional filters)
router.get('/', authorize('provider', 'nurse', 'admin', 'secretary'), asyncHandler(async (req, res) => {
  const documents = await documentService.findAll();

  await logAudit(req, {
    action: 'view',
    resourceType: 'document',
    details: { count: documents.length },
  });

  res.json({ documents });
}));

// Get documents for a patient
router.get('/patient/:patientId', asyncHandler(async (req, res) => {
  const documents = await documentService.findByPatientId(req.params.patientId);

  await logAudit(req, {
    action: 'view',
    resourceType: 'document',
    patientId: req.params.patientId,
    details: { count: documents.length },
  });

  res.json({ documents });
}));

// Upload a document
router.post(
  '/patient/:patientId',
  authorize('provider', 'nurse', 'admin', 'secretary'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('No file uploaded');

    const bodyResult = uploadDocumentBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw new BadRequestError(bodyResult.error.errors.map(e => e.message).join(', '));
    }

    const document = await documentService.create({
      patientId: req.params.patientId,
      uploadedBy: req.user!.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      description: bodyResult.data.description,
      category: bodyResult.data.category,
    });

    await logAudit(req, {
      action: 'create',
      resourceType: 'document',
      resourceId: document.id,
      patientId: req.params.patientId,
      details: { filename: document.originalName },
    });

    res.status(201).json({ document });
  })
);

// Download a document
router.get('/:id/download', asyncHandler(async (req, res) => {
  const document = await documentService.findById(req.params.id);
  if (!document) throw new NotFoundError('Document not found');

  const filePath = path.join(uploadsDir, document.filename);
  if (!fs.existsSync(filePath)) throw new NotFoundError('File not found');

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
}));

// Delete a document
router.delete('/:id', authorize('provider', 'admin'), asyncHandler(async (req, res) => {
  const document = await documentService.findById(req.params.id);
  if (!document) throw new NotFoundError('Document not found');

  // Delete DB record first, then file (safer ordering)
  await documentService.remove(req.params.id);

  const filePath = path.join(uploadsDir, document.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await logAudit(req, {
    action: 'delete',
    resourceType: 'document',
    resourceId: req.params.id,
    patientId: document.patientId,
    details: { filename: document.originalName },
  });

  res.json({ message: 'Document deleted' });
}));

export default router;
