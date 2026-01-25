import { createWorker, Worker } from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { query } from '../db/index.js';

// Interfaces
export interface OcrResult {
  id: string;
  documentId: string;
  rawText: string | null;
  confidenceScore: number | null;
  documentType: string | null;
  extractedData: Record<string, unknown> | null;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage: string | null;
  processedAt: Date | null;
  createdAt: Date;
}

export interface OcrFieldMapping {
  id: string;
  ocrResultId: string;
  patientId: string | null;
  fieldName: string;
  extractedValue: string;
  originalValue: string | null;
  confidenceScore: number | null;
  status: 'pending' | 'applied' | 'rejected';
  appliedAt: Date | null;
  appliedBy: string | null;
  createdAt: Date;
}

export interface ProcessOcrInput {
  documentId: string;
  filePath: string;
  mimeType: string;
}

export interface OcrProcessingResult {
  text: string;
  confidence: number;
  documentType: string;
}

// Row mapping functions
function mapOcrResultRow(row: Record<string, unknown>): OcrResult {
  return {
    id: row.id as string,
    documentId: row.document_id as string,
    rawText: row.raw_text as string | null,
    confidenceScore: row.confidence_score ? Number(row.confidence_score) : null,
    documentType: row.document_type as string | null,
    extractedData: row.extracted_data as Record<string, unknown> | null,
    processingStatus: row.processing_status as OcrResult['processingStatus'],
    errorMessage: row.error_message as string | null,
    processedAt: row.processed_at as Date | null,
    createdAt: row.created_at as Date,
  };
}

function mapFieldMappingRow(row: Record<string, unknown>): OcrFieldMapping {
  return {
    id: row.id as string,
    ocrResultId: row.ocr_result_id as string,
    patientId: row.patient_id as string | null,
    fieldName: row.field_name as string,
    extractedValue: row.extracted_value as string,
    originalValue: row.original_value as string | null,
    confidenceScore: row.confidence_score ? Number(row.confidence_score) : null,
    status: row.status as OcrFieldMapping['status'],
    appliedAt: row.applied_at as Date | null,
    appliedBy: row.applied_by as string | null,
    createdAt: row.created_at as Date,
  };
}

// Database operations
export async function findOcrResultByDocumentId(documentId: string): Promise<OcrResult | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM document_ocr_results WHERE document_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [documentId]
  );
  return result.rows.length > 0 ? mapOcrResultRow(result.rows[0]) : null;
}

export async function findOcrResultById(id: string): Promise<OcrResult | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM document_ocr_results WHERE id = $1`,
    [id]
  );
  return result.rows.length > 0 ? mapOcrResultRow(result.rows[0]) : null;
}

export async function createOcrResult(documentId: string): Promise<OcrResult> {
  const result = await query<Record<string, unknown>>(
    `INSERT INTO document_ocr_results (document_id, processing_status)
     VALUES ($1, 'pending')
     RETURNING *`,
    [documentId]
  );
  return mapOcrResultRow(result.rows[0]);
}

export async function updateOcrResult(
  id: string,
  updates: Partial<{
    rawText: string;
    confidenceScore: number;
    documentType: string;
    extractedData: Record<string, unknown>;
    processingStatus: string;
    errorMessage: string;
  }>
): Promise<OcrResult | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  const fieldMap: Record<string, string> = {
    rawText: 'raw_text',
    confidenceScore: 'confidence_score',
    documentType: 'document_type',
    extractedData: 'extracted_data',
    processingStatus: 'processing_status',
    errorMessage: 'error_message',
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (key in updates) {
      fields.push(`${dbField} = $${paramCount}`);
      const value = updates[key as keyof typeof updates];
      values.push(key === 'extractedData' ? JSON.stringify(value) : value);
      paramCount++;
    }
  }

  if (updates.processingStatus === 'completed' || updates.processingStatus === 'failed') {
    fields.push(`processed_at = CURRENT_TIMESTAMP`);
  }

  if (fields.length === 0) return findOcrResultById(id);

  values.push(id);

  const result = await query<Record<string, unknown>>(
    `UPDATE document_ocr_results SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  return result.rows.length > 0 ? mapOcrResultRow(result.rows[0]) : null;
}

export async function findFieldMappingsByOcrResultId(ocrResultId: string): Promise<OcrFieldMapping[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM ocr_field_mappings WHERE ocr_result_id = $1 ORDER BY field_name`,
    [ocrResultId]
  );
  return result.rows.map(mapFieldMappingRow);
}

export async function createFieldMapping(input: {
  ocrResultId: string;
  patientId?: string;
  fieldName: string;
  extractedValue: string;
  originalValue?: string;
  confidenceScore?: number;
}): Promise<OcrFieldMapping> {
  const result = await query<Record<string, unknown>>(
    `INSERT INTO ocr_field_mappings (ocr_result_id, patient_id, field_name, extracted_value, original_value, confidence_score)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.ocrResultId,
      input.patientId || null,
      input.fieldName,
      input.extractedValue,
      input.originalValue || null,
      input.confidenceScore || null,
    ]
  );
  return mapFieldMappingRow(result.rows[0]);
}

export async function updateFieldMappingStatus(
  id: string,
  status: 'applied' | 'rejected',
  appliedBy?: string
): Promise<OcrFieldMapping | null> {
  const result = await query<Record<string, unknown>>(
    `UPDATE ocr_field_mappings
     SET status = $1, applied_at = CASE WHEN $1 = 'applied' THEN CURRENT_TIMESTAMP ELSE NULL END, applied_by = $2
     WHERE id = $3
     RETURNING *`,
    [status, appliedBy || null, id]
  );
  return result.rows.length > 0 ? mapFieldMappingRow(result.rows[0]) : null;
}

// OCR Processing
let worker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!worker) {
    worker = await createWorker('eng');
  }
  return worker;
}

async function convertPdfToImages(pdfPath: string): Promise<string[]> {
  // Dynamic import for pdf-to-img (ESM module)
  const { pdf } = await import('pdf-to-img');

  const images: string[] = [];
  const tempDir = path.join(path.dirname(pdfPath), 'temp_ocr');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    const document = await pdf(pdfPath, { scale: 2.0 });
    let pageNum = 0;

    for await (const image of document) {
      const imagePath = path.join(tempDir, `page_${pageNum}.png`);
      fs.writeFileSync(imagePath, image);
      images.push(imagePath);
      pageNum++;
    }
  } catch (error) {
    console.error('PDF conversion error:', error);
    throw new Error('Failed to convert PDF to images');
  }

  return images;
}

async function preprocessImage(imagePath: string): Promise<Buffer> {
  // Preprocess image for better OCR accuracy
  return await sharp(imagePath)
    .grayscale()
    .normalize()
    .sharpen()
    .toBuffer();
}

export async function processDocument(input: ProcessOcrInput): Promise<OcrProcessingResult> {
  const { filePath, mimeType } = input;

  let imagePaths: string[] = [];
  const tempFiles: string[] = [];

  try {
    // Convert PDF to images if needed
    if (mimeType === 'application/pdf') {
      imagePaths = await convertPdfToImages(filePath);
      tempFiles.push(...imagePaths);
    } else {
      imagePaths = [filePath];
    }

    const tesseractWorker = await getWorker();
    const textParts: string[] = [];
    let totalConfidence = 0;

    // Process each image
    for (const imagePath of imagePaths) {
      const imageBuffer = await preprocessImage(imagePath);
      const { data } = await tesseractWorker.recognize(imageBuffer);
      textParts.push(data.text);
      totalConfidence += data.confidence;
    }

    // Combine text from all pages
    const fullText = textParts.join('\n\n---PAGE BREAK---\n\n');
    const avgConfidence = totalConfidence / imagePaths.length;

    // Classify document type
    const documentType = classifyDocument(fullText);

    return {
      text: fullText,
      confidence: avgConfidence / 100, // Normalize to 0-1
      documentType,
    };
  } finally {
    // Clean up temporary files
    for (const tempFile of tempFiles) {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Clean up temp directory if it exists
    const tempDir = path.join(path.dirname(filePath), 'temp_ocr');
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmdirSync(tempDir);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

function classifyDocument(text: string): string {
  const lowerText = text.toLowerCase();

  // Check for referral letter indicators
  const referralKeywords = [
    'referral', 'referring physician', 'referred by', 'consultation request',
    'dear doctor', 'to whom it may concern', 'please see', 'evaluation requested',
  ];
  if (referralKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'referral';
  }

  // Check for lab result indicators
  const labKeywords = [
    'laboratory', 'lab result', 'test result', 'specimen', 'reference range',
    'normal range', 'abnormal', 'blood test', 'urinalysis', 'cbc', 'cmp',
    'lipid panel', 'hemoglobin', 'glucose', 'cholesterol',
  ];
  if (labKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'lab_result';
  }

  // Check for intake form indicators
  const intakeKeywords = [
    'patient information', 'intake form', 'registration form', 'medical history',
    'emergency contact', 'insurance information', 'primary care physician',
    'allergies', 'current medications', 'past medical history',
  ];
  if (intakeKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'intake_form';
  }

  return 'unknown';
}

// Cleanup worker on process exit
process.on('beforeExit', async () => {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
});
