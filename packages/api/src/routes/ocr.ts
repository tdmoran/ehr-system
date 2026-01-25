import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import * as ocrService from '../services/ocr.service.js';
import * as documentService from '../services/document.service.js';
import * as patientService from '../services/patient.service.js';
import * as fieldExtractor from '../services/field-extractor.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
const uploadsDir = path.join(process.cwd(), 'uploads');

router.use(authenticate);

// Trigger OCR processing for a document
router.post(
  '/documents/:documentId/process',
  authorize('provider', 'nurse', 'admin', 'secretary'),
  async (req, res) => {
    try {
      const { documentId } = req.params;

      // Get the document
      const document = await documentService.findById(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check if already processing or completed
      const existingResult = await ocrService.findOcrResultByDocumentId(documentId);
      if (existingResult?.processingStatus === 'processing') {
        return res.status(409).json({ error: 'OCR processing already in progress' });
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
    } catch (error) {
      console.error('Trigger OCR error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get OCR result for a document
router.get('/documents/:documentId/result', async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await documentService.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const ocrResult = await ocrService.findOcrResultByDocumentId(documentId);
    if (!ocrResult) {
      return res.status(404).json({ error: 'No OCR result found for this document' });
    }

    await logAudit(req, {
      action: 'view',
      resourceType: 'ocr_result',
      resourceId: ocrResult.id,
      patientId: document.patientId,
    });

    res.json({ ocrResult });
  } catch (error) {
    console.error('Get OCR result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get extracted fields for a document
router.get('/documents/:documentId/extracted-fields', async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await documentService.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const ocrResult = await ocrService.findOcrResultByDocumentId(documentId);
    if (!ocrResult) {
      return res.status(404).json({ error: 'No OCR result found for this document' });
    }

    if (ocrResult.processingStatus !== 'completed') {
      return res.status(400).json({
        error: 'OCR processing not completed',
        status: ocrResult.processingStatus,
      });
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
  } catch (error) {
    console.error('Get extracted fields error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Apply selected fields to patient
router.post(
  '/documents/:documentId/apply-fields',
  authorize('provider', 'nurse', 'admin'),
  async (req, res) => {
    try {
      const { documentId } = req.params;
      const { fieldIds } = req.body as { fieldIds: string[] };

      if (!fieldIds || !Array.isArray(fieldIds) || fieldIds.length === 0) {
        return res.status(400).json({ error: 'fieldIds array is required' });
      }

      const document = await documentService.findById(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const ocrResult = await ocrService.findOcrResultByDocumentId(documentId);
      if (!ocrResult || ocrResult.processingStatus !== 'completed') {
        return res.status(400).json({ error: 'OCR processing not completed' });
      }

      const fieldMappings = await ocrService.findFieldMappingsByOcrResultId(ocrResult.id);
      const selectedMappings = fieldMappings.filter((m) => fieldIds.includes(m.id));

      if (selectedMappings.length === 0) {
        return res.status(400).json({ error: 'No valid field IDs provided' });
      }

      // Build update object for patient
      const patientUpdate: Record<string, string> = {};
      for (const mapping of selectedMappings) {
        patientUpdate[mapping.fieldName] = mapping.extractedValue;
      }

      // Update patient
      const updatedPatient = await patientService.update(document.patientId, patientUpdate);

      if (!updatedPatient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      // Update field mapping statuses
      for (const mapping of selectedMappings) {
        await ocrService.updateFieldMappingStatus(mapping.id, 'applied', req.user!.id);
      }

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
    } catch (error) {
      console.error('Apply fields error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Reject selected fields (mark as rejected)
router.post(
  '/documents/:documentId/reject-fields',
  authorize('provider', 'nurse', 'admin'),
  async (req, res) => {
    try {
      const { documentId } = req.params;
      const { fieldIds } = req.body as { fieldIds: string[] };

      if (!fieldIds || !Array.isArray(fieldIds) || fieldIds.length === 0) {
        return res.status(400).json({ error: 'fieldIds array is required' });
      }

      const document = await documentService.findById(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const ocrResult = await ocrService.findOcrResultByDocumentId(documentId);
      if (!ocrResult) {
        return res.status(404).json({ error: 'No OCR result found for this document' });
      }

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
    } catch (error) {
      console.error('Reject fields error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
