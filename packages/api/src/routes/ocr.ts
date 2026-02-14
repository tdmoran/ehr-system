import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import * as ocrService from '../services/ocr.service.js';
import * as documentService from '../services/document.service.js';
import * as patientService from '../services/patient.service.js';
import * as fieldExtractor from '../services/field-extractor.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, NotFoundError, BadRequestError, ConflictError } from '../errors/index.js';
import { withTransaction } from '../db/index.js';

const fieldIdsSchema = z.object({
  fieldIds: z.array(z.string().uuid()).min(1, 'At least one field ID is required'),
});

const router = Router();
const uploadsDir = path.join(process.cwd(), 'uploads');

router.use(authenticate);

// Trigger OCR processing for a document
router.post(
  '/documents/:documentId/process',
  authorize('provider', 'nurse', 'admin', 'secretary'),
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    // Get the document
    const document = await documentService.findById(documentId);
    if (!document) throw new NotFoundError('Document not found');

    // Check if already processing or completed
    const existingResult = await ocrService.findOcrResultByDocumentId(documentId);
    if (existingResult?.processingStatus === 'processing') {
      throw new ConflictError('OCR processing already in progress');
    }

    // Create or update OCR result record
    let ocrResult: ocrService.OcrResult;
    if (existingResult) {
      ocrResult = (await ocrService.updateOcrResult(existingResult.id, {
        processingStatus: 'processing',
      }))!;
    } else {
      ocrResult = await ocrService.createOcrResult(documentId);
      await ocrService.updateOcrResult(ocrResult.id, { processingStatus: 'processing' });
    }

    // Get patient ID for this document
    const patientId = document.patientId;

    // Get current patient data for comparison
    const patient = await patientService.findById(patientId);

    await logAudit(req, {
      action: 'create',
      resourceType: 'ocr_processing',
      resourceId: ocrResult.id,
      patientId,
      details: { documentId, filename: document.originalName },
    });

    // Process in the background
    (async () => {
      try {
        const filePath = path.join(uploadsDir, document.filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          console.error('OCR error: File not found at', filePath);
          await ocrService.updateOcrResult(ocrResult.id, {
            processingStatus: 'failed',
            errorMessage: 'File not found on server. Files may have been lost during deployment.',
          });
          return;
        }

        // Run OCR
        const result = await ocrService.processDocument({
          documentId,
          filePath,
          mimeType: document.mimeType,
        });

        // Extract fields based on document type
        const extractedData = fieldExtractor.extractAllData(result.text, result.documentType);

        // Update OCR result with extracted data
        await ocrService.updateOcrResult(ocrResult.id, {
          rawText: result.text,
          confidenceScore: result.confidence,
          documentType: result.documentType,
          extractedData: extractedData as Record<string, unknown>,
          processingStatus: 'completed',
        });

        // Create field mappings for patient data
        const patientData = extractedData.patientData;
        for (const [fieldName, fieldData] of Object.entries(patientData)) {
          if (fieldData) {
            const originalValue = patient ? (patient as unknown as Record<string, unknown>)[fieldName] as string | null : null;

            await ocrService.createFieldMapping({
              ocrResultId: ocrResult.id,
              patientId,
              fieldName,
              extractedValue: fieldData.value,
              originalValue: originalValue ?? undefined,
              confidenceScore: fieldData.confidence,
            });
          }
        }
      } catch (error) {
        console.error('OCR processing error:', error);
        await ocrService.updateOcrResult(ocrResult.id, {
          processingStatus: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    })();

    // Return immediately with processing status
    res.status(202).json({
      message: 'OCR processing started',
      ocrResultId: ocrResult.id,
      status: 'processing',
    });
  })
);

// Get OCR result for a document
router.get('/documents/:documentId/result', asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  const document = await documentService.findById(documentId);
  if (!document) throw new NotFoundError('Document not found');

  const ocrResult = await ocrService.findOcrResultByDocumentId(documentId);
  if (!ocrResult) throw new NotFoundError('No OCR result found for this document');

  await logAudit(req, {
    action: 'view',
    resourceType: 'ocr_result',
    resourceId: ocrResult.id,
    patientId: document.patientId,
  });

  res.json({ ocrResult });
}));

// Get extracted fields for a document
router.get('/documents/:documentId/extracted-fields', asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  const document = await documentService.findById(documentId);
  if (!document) throw new NotFoundError('Document not found');

  const ocrResult = await ocrService.findOcrResultByDocumentId(documentId);
  if (!ocrResult) throw new NotFoundError('No OCR result found for this document');

  if (ocrResult.processingStatus !== 'completed') {
    throw new BadRequestError(`OCR processing not completed (status: ${ocrResult.processingStatus})`);
  }

  const fieldMappings = await ocrService.findFieldMappingsByOcrResultId(ocrResult.id);

  await logAudit(req, {
    action: 'view',
    resourceType: 'ocr_field_mappings',
    resourceId: ocrResult.id,
    patientId: document.patientId,
    details: { fieldCount: fieldMappings.length },
  });

  res.json({
    ocrResult,
    fieldMappings,
  });
}));

// Apply selected fields to patient — wrapped in transaction for atomicity
router.post(
  '/documents/:documentId/apply-fields',
  authorize('provider', 'nurse', 'admin'),
  validate(fieldIdsSchema),
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const { fieldIds } = req.body;

    const document = await documentService.findById(documentId);
    if (!document) throw new NotFoundError('Document not found');

    const ocrResult = await ocrService.findOcrResultByDocumentId(documentId);
    if (!ocrResult || ocrResult.processingStatus !== 'completed') {
      throw new BadRequestError('OCR processing not completed');
    }

    const fieldMappings = await ocrService.findFieldMappingsByOcrResultId(ocrResult.id);
    const selectedMappings = fieldMappings.filter((m) => fieldIds.includes(m.id));

    if (selectedMappings.length === 0) {
      throw new BadRequestError('No valid field IDs provided');
    }

    // Build update object for patient
    const patientUpdate: Record<string, string> = {};
    for (const mapping of selectedMappings) {
      patientUpdate[mapping.fieldName] = mapping.extractedValue;
    }

    // Wrap patient update + field mapping status updates in a transaction
    const updatedPatient = await withTransaction(async (client) => {
      // Update patient
      const patientResult = await client.query(
        buildPatientUpdateQuery(document.patientId, patientUpdate)
      );

      if (patientResult.rows.length === 0) throw new NotFoundError('Patient not found');

      // Update field mapping statuses
      for (const mapping of selectedMappings) {
        await client.query(
          `UPDATE ocr_field_mappings
           SET status = 'applied', applied_at = CURRENT_TIMESTAMP, applied_by = $1
           WHERE id = $2`,
          [req.user!.id, mapping.id]
        );
      }

      return patientResult.rows[0];
    });

    await logAudit(req, {
      action: 'update',
      resourceType: 'patient',
      resourceId: document.patientId,
      patientId: document.patientId,
      details: {
        source: 'ocr',
        documentId,
        appliedFields: Object.keys(patientUpdate),
      },
    });

    res.json({
      message: 'Fields applied successfully',
      updatedFields: Object.keys(patientUpdate),
      patient: updatedPatient,
    });
  })
);

// Reject selected fields (mark as rejected)
router.post(
  '/documents/:documentId/reject-fields',
  authorize('provider', 'nurse', 'admin'),
  validate(fieldIdsSchema),
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const { fieldIds } = req.body;

    const document = await documentService.findById(documentId);
    if (!document) throw new NotFoundError('Document not found');

    const ocrResult = await ocrService.findOcrResultByDocumentId(documentId);
    if (!ocrResult) throw new NotFoundError('No OCR result found for this document');

    const fieldMappings = await ocrService.findFieldMappingsByOcrResultId(ocrResult.id);
    const selectedMappings = fieldMappings.filter((m) => fieldIds.includes(m.id));

    for (const mapping of selectedMappings) {
      await ocrService.updateFieldMappingStatus(mapping.id, 'rejected', req.user!.id);
    }

    await logAudit(req, {
      action: 'update',
      resourceType: 'ocr_field_mappings',
      resourceId: ocrResult.id,
      patientId: document.patientId,
      details: { rejectedFields: fieldIds },
    });

    res.json({
      message: 'Fields rejected',
      rejectedCount: selectedMappings.length,
    });
  })
);

/**
 * Build a parameterized UPDATE query for the patients table.
 * Returns { text, values } compatible with client.query().
 */
function buildPatientUpdateQuery(
  patientId: string,
  updates: Record<string, string>
): { text: string; values: unknown[] } {
  const fieldMap: Record<string, string> = {
    firstName: 'first_name',
    lastName: 'last_name',
    dateOfBirth: 'date_of_birth',
    gender: 'gender',
    email: 'email',
    phone: 'phone',
    addressLine1: 'address_line1',
    addressLine2: 'address_line2',
    city: 'city',
    state: 'state',
    zip: 'zip',
    emergencyContactName: 'emergency_contact_name',
    emergencyContactPhone: 'emergency_contact_phone',
    insuranceProvider: 'insurance_provider',
    insuranceId: 'insurance_id',
    notes: 'notes',
    clinicNotes: 'clinic_notes',
  };

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  for (const [key, value] of Object.entries(updates)) {
    const dbField = fieldMap[key];
    if (dbField) {
      setClauses.push(`${dbField} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  }

  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(patientId);

  return {
    text: `UPDATE patients SET ${setClauses.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values,
  };
}

export default router;
