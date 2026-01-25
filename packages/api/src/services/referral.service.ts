import { query } from '../db/index.js';
import { processDocument } from './ocr.service.js';
import { extractPatientData, extractReferralData } from './field-extractor.service.js';
import { extractWithAI } from './ai-extractor.service.js';
import path from 'path';

// Interfaces
export interface ReferralScan {
  id: string;
  uploadedBy: string;
  filename: string;
  originalName: string;
  mimeType: string | null;
  fileSize: number | null;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralOcrResult {
  id: string;
  referralScanId: string;
  rawText: string | null;
  confidenceScore: number | null;
  extractedData: Record<string, unknown> | null;
  // Extracted patient info
  patientFirstName: string | null;
  patientLastName: string | null;
  patientDob: string | null;
  patientPhone: string | null;
  // Extracted referral info
  referringPhysician: string | null;
  referringFacility: string | null;
  reasonForReferral: string | null;
  // Matching
  matchedPatientId: string | null;
  matchConfidence: number | null;
  // Resolution
  resolutionStatus: 'pending' | 'created' | 'added' | 'skipped';
  resolvedPatientId: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PendingReferral {
  id: string;
  referralScanId: string;
  filename: string;
  originalName: string;
  processingStatus: string;
  rawText: string | null;
  confidenceScore: number | null;
  patientFirstName: string | null;
  patientLastName: string | null;
  patientDob: string | null;
  patientPhone: string | null;
  referringPhysician: string | null;
  referringFacility: string | null;
  reasonForReferral: string | null;
  matchedPatientId: string | null;
  matchedPatientFirstName: string | null;
  matchedPatientLastName: string | null;
  matchedPatientMrn: string | null;
  matchConfidence: number | null;
  resolutionStatus: string;
  createdAt: Date;
}

export interface CreateReferralScanInput {
  uploadedBy: string;
  filename: string;
  originalName: string;
  mimeType?: string;
  fileSize?: number;
}

export interface MatchedPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  matchScore: number;
}

// Row mapping functions
function mapReferralScanRow(row: Record<string, unknown>): ReferralScan {
  return {
    id: row.id as string,
    uploadedBy: row.uploaded_by as string,
    filename: row.filename as string,
    originalName: row.original_name as string,
    mimeType: row.mime_type as string | null,
    fileSize: row.file_size as number | null,
    processingStatus: row.processing_status as ReferralScan['processingStatus'],
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function mapReferralOcrResultRow(row: Record<string, unknown>): ReferralOcrResult {
  return {
    id: row.id as string,
    referralScanId: row.referral_scan_id as string,
    rawText: row.raw_text as string | null,
    confidenceScore: row.confidence_score ? Number(row.confidence_score) : null,
    extractedData: row.extracted_data as Record<string, unknown> | null,
    patientFirstName: row.patient_first_name as string | null,
    patientLastName: row.patient_last_name as string | null,
    patientDob: row.patient_dob as string | null,
    patientPhone: row.patient_phone as string | null,
    referringPhysician: row.referring_physician as string | null,
    referringFacility: row.referring_facility as string | null,
    reasonForReferral: row.reason_for_referral as string | null,
    matchedPatientId: row.matched_patient_id as string | null,
    matchConfidence: row.match_confidence ? Number(row.match_confidence) : null,
    resolutionStatus: row.resolution_status as ReferralOcrResult['resolutionStatus'],
    resolvedPatientId: row.resolved_patient_id as string | null,
    resolvedBy: row.resolved_by as string | null,
    resolvedAt: row.resolved_at as Date | null,
    processedAt: row.processed_at as Date | null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function mapPendingReferralRow(row: Record<string, unknown>): PendingReferral {
  return {
    id: row.id as string,
    referralScanId: row.referral_scan_id as string,
    filename: row.filename as string,
    originalName: row.original_name as string,
    processingStatus: row.processing_status as string,
    rawText: row.raw_text as string | null,
    confidenceScore: row.confidence_score ? Number(row.confidence_score) : null,
    patientFirstName: row.patient_first_name as string | null,
    patientLastName: row.patient_last_name as string | null,
    patientDob: row.patient_dob as string | null,
    patientPhone: row.patient_phone as string | null,
    referringPhysician: row.referring_physician as string | null,
    referringFacility: row.referring_facility as string | null,
    reasonForReferral: row.reason_for_referral as string | null,
    matchedPatientId: row.matched_patient_id as string | null,
    matchedPatientFirstName: row.matched_patient_first_name as string | null,
    matchedPatientLastName: row.matched_patient_last_name as string | null,
    matchedPatientMrn: row.matched_patient_mrn as string | null,
    matchConfidence: row.match_confidence ? Number(row.match_confidence) : null,
    resolutionStatus: row.resolution_status as string,
    createdAt: row.created_at as Date,
  };
}

// Database operations - Referral Scans
export async function createReferralScan(input: CreateReferralScanInput): Promise<ReferralScan> {
  const result = await query<Record<string, unknown>>(
    `INSERT INTO referral_scans (uploaded_by, filename, original_name, mime_type, file_size)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.uploadedBy, input.filename, input.originalName, input.mimeType || null, input.fileSize || null]
  );
  return mapReferralScanRow(result.rows[0]);
}

export async function findReferralScanById(id: string): Promise<ReferralScan | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM referral_scans WHERE id = $1`,
    [id]
  );
  return result.rows.length > 0 ? mapReferralScanRow(result.rows[0]) : null;
}

export async function updateReferralScanStatus(
  id: string,
  status: ReferralScan['processingStatus']
): Promise<ReferralScan | null> {
  const result = await query<Record<string, unknown>>(
    `UPDATE referral_scans SET processing_status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return result.rows.length > 0 ? mapReferralScanRow(result.rows[0]) : null;
}

// Database operations - OCR Results
export async function createReferralOcrResult(referralScanId: string): Promise<ReferralOcrResult> {
  const result = await query<Record<string, unknown>>(
    `INSERT INTO referral_ocr_results (referral_scan_id)
     VALUES ($1)
     RETURNING *`,
    [referralScanId]
  );
  return mapReferralOcrResultRow(result.rows[0]);
}

export async function findOcrResultByReferralScanId(referralScanId: string): Promise<ReferralOcrResult | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM referral_ocr_results WHERE referral_scan_id = $1`,
    [referralScanId]
  );
  return result.rows.length > 0 ? mapReferralOcrResultRow(result.rows[0]) : null;
}

export async function findOcrResultById(id: string): Promise<ReferralOcrResult | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM referral_ocr_results WHERE id = $1`,
    [id]
  );
  return result.rows.length > 0 ? mapReferralOcrResultRow(result.rows[0]) : null;
}

export async function updateReferralOcrResult(
  id: string,
  updates: Partial<{
    rawText: string;
    confidenceScore: number;
    extractedData: Record<string, unknown>;
    patientFirstName: string;
    patientLastName: string;
    patientDob: string;
    patientPhone: string;
    referringPhysician: string;
    referringFacility: string;
    reasonForReferral: string;
    matchedPatientId: string;
    matchConfidence: number;
    resolutionStatus: string;
    resolvedPatientId: string;
    resolvedBy: string;
  }>
): Promise<ReferralOcrResult | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  const fieldMap: Record<string, string> = {
    rawText: 'raw_text',
    confidenceScore: 'confidence_score',
    extractedData: 'extracted_data',
    patientFirstName: 'patient_first_name',
    patientLastName: 'patient_last_name',
    patientDob: 'patient_dob',
    patientPhone: 'patient_phone',
    referringPhysician: 'referring_physician',
    referringFacility: 'referring_facility',
    reasonForReferral: 'reason_for_referral',
    matchedPatientId: 'matched_patient_id',
    matchConfidence: 'match_confidence',
    resolutionStatus: 'resolution_status',
    resolvedPatientId: 'resolved_patient_id',
    resolvedBy: 'resolved_by',
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (key in updates) {
      fields.push(`${dbField} = $${paramCount}`);
      const value = updates[key as keyof typeof updates];
      values.push(key === 'extractedData' ? JSON.stringify(value) : value);
      paramCount++;
    }
  }

  // Set processed_at if completing processing
  if (updates.rawText !== undefined) {
    fields.push(`processed_at = CURRENT_TIMESTAMP`);
  }

  // Set resolved_at if resolving
  if (updates.resolutionStatus && updates.resolutionStatus !== 'pending') {
    fields.push(`resolved_at = CURRENT_TIMESTAMP`);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);

  if (fields.length === 1) return findOcrResultById(id); // Only updated_at

  values.push(id);

  const result = await query<Record<string, unknown>>(
    `UPDATE referral_ocr_results SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  return result.rows.length > 0 ? mapReferralOcrResultRow(result.rows[0]) : null;
}

// Get pending referrals for review
export async function findPendingReferrals(): Promise<PendingReferral[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT
      ocr.id,
      ocr.referral_scan_id,
      rs.filename,
      rs.original_name,
      rs.processing_status,
      ocr.raw_text,
      ocr.confidence_score,
      ocr.patient_first_name,
      ocr.patient_last_name,
      ocr.patient_dob,
      ocr.patient_phone,
      ocr.referring_physician,
      ocr.referring_facility,
      ocr.reason_for_referral,
      ocr.matched_patient_id,
      p.first_name as matched_patient_first_name,
      p.last_name as matched_patient_last_name,
      p.mrn as matched_patient_mrn,
      ocr.match_confidence,
      ocr.resolution_status,
      ocr.created_at
    FROM referral_ocr_results ocr
    JOIN referral_scans rs ON rs.id = ocr.referral_scan_id
    LEFT JOIN patients p ON p.id = ocr.matched_patient_id
    WHERE ocr.resolution_status = 'pending'
      AND rs.processing_status = 'completed'
    ORDER BY ocr.created_at ASC`
  );
  return result.rows.map(mapPendingReferralRow);
}

// Find matching patients
export async function findMatchingPatient(
  firstName: string | null,
  lastName: string | null,
  dob: string | null
): Promise<MatchedPatient | null> {
  if (!firstName && !lastName && !dob) return null;

  // Build a scoring query that matches on name and DOB
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  // Exact last name match is worth more
  if (lastName) {
    conditions.push(`CASE WHEN LOWER(last_name) = LOWER($${paramCount}) THEN 0.4 ELSE 0 END`);
    values.push(lastName);
    paramCount++;
  }

  // Exact first name match
  if (firstName) {
    conditions.push(`CASE WHEN LOWER(first_name) = LOWER($${paramCount}) THEN 0.3 ELSE 0 END`);
    values.push(firstName);
    paramCount++;
  }

  // DOB match (highest weight)
  if (dob) {
    conditions.push(`CASE WHEN date_of_birth::text = $${paramCount} THEN 0.5 ELSE 0 END`);
    values.push(dob);
    paramCount++;
  }

  if (conditions.length === 0) return null;

  const scoreExpr = conditions.join(' + ');

  const result = await query<Record<string, unknown>>(
    `SELECT
      id, mrn, first_name, last_name, date_of_birth,
      (${scoreExpr}) as match_score
    FROM patients
    WHERE active = true
      AND (${scoreExpr}) >= 0.5
    ORDER BY match_score DESC
    LIMIT 1`,
    values
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    mrn: row.mrn as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    dateOfBirth: row.date_of_birth as string,
    matchScore: Number(row.match_score),
  };
}

// Process a referral scan with OCR
export async function processReferralScan(
  referralScanId: string,
  filePath: string,
  mimeType: string
): Promise<ReferralOcrResult> {
  // Update scan status to processing
  await updateReferralScanStatus(referralScanId, 'processing');

  // Create OCR result record
  const ocrResult = await createReferralOcrResult(referralScanId);

  try {
    // Run OCR
    const processingResult = await processDocument({
      documentId: referralScanId,
      filePath,
      mimeType,
    });

    // Variables for extracted data
    let patientFirstName: string | undefined;
    let patientLastName: string | undefined;
    let patientDob: string | undefined;
    let patientPhone: string | undefined;
    let referringPhysician: string | undefined;
    let referringFacility: string | undefined;
    let reasonForReferral: string | undefined;
    let extractedData: Record<string, unknown> = {};
    let confidenceScore = processingResult.confidence;

    // Try AI extraction first (if ANTHROPIC_API_KEY is set)
    if (process.env.ANTHROPIC_API_KEY) {
      console.log('Using AI extraction for referral scan...');
      try {
        const aiResult = await extractWithAI(processingResult.text);

        if (aiResult.confidence > 0) {
          // Use AI results
          patientFirstName = aiResult.patient.firstName || undefined;
          patientLastName = aiResult.patient.lastName || undefined;
          patientDob = aiResult.patient.dateOfBirth || undefined;
          patientPhone = aiResult.patient.phone || undefined;
          referringPhysician = aiResult.referral.referringPhysician || undefined;
          referringFacility = aiResult.referral.referringFacility || undefined;
          reasonForReferral = aiResult.referral.reasonForReferral || undefined;
          confidenceScore = aiResult.confidence;
          extractedData = { aiExtraction: aiResult, method: 'ai' };
          console.log('AI extraction successful:', {
            firstName: patientFirstName,
            lastName: patientLastName,
            dob: patientDob,
            confidence: confidenceScore
          });
        }
      } catch (aiError) {
        console.error('AI extraction failed, falling back to regex:', aiError);
      }
    }

    // Fall back to regex extraction if AI didn't work
    if (!patientFirstName && !patientLastName) {
      console.log('Using regex extraction for referral scan...');
      const patientData = extractPatientData(processingResult.text);
      const referralData = extractReferralData(processingResult.text);

      patientFirstName = patientData.firstName?.value;
      patientLastName = patientData.lastName?.value;
      patientDob = patientData.dateOfBirth?.value;
      patientPhone = patientData.phone?.value;
      referringPhysician = referralData.referringPhysician?.value;
      referringFacility = referralData.referringFacility?.value;
      reasonForReferral = referralData.reasonForReferral?.value;
      extractedData = { patientData, referralData, method: 'regex' };
    }

    // Try to find a matching patient
    const matchedPatient = await findMatchingPatient(patientFirstName || null, patientLastName || null, patientDob || null);

    // Update OCR result with extracted data
    const updatedResult = await updateReferralOcrResult(ocrResult.id, {
      rawText: processingResult.text,
      confidenceScore,
      extractedData,
      patientFirstName,
      patientLastName,
      patientDob,
      patientPhone,
      referringPhysician,
      referringFacility,
      reasonForReferral,
      matchedPatientId: matchedPatient?.id,
      matchConfidence: matchedPatient?.matchScore,
    });

    // Update scan status to completed
    await updateReferralScanStatus(referralScanId, 'completed');

    return updatedResult!;
  } catch (error) {
    // Update scan status to failed
    await updateReferralScanStatus(referralScanId, 'failed');
    throw error;
  }
}

// Resolve a referral - mark as created (new patient was created)
export async function resolveAsCreated(
  ocrResultId: string,
  patientId: string,
  resolvedBy: string
): Promise<ReferralOcrResult | null> {
  return updateReferralOcrResult(ocrResultId, {
    resolutionStatus: 'created',
    resolvedPatientId: patientId,
    resolvedBy,
  });
}

// Resolve a referral - mark as added (added to existing patient)
export async function resolveAsAdded(
  ocrResultId: string,
  patientId: string,
  resolvedBy: string
): Promise<ReferralOcrResult | null> {
  return updateReferralOcrResult(ocrResultId, {
    resolutionStatus: 'added',
    resolvedPatientId: patientId,
    resolvedBy,
  });
}

// Resolve a referral - mark as skipped
export async function resolveAsSkipped(
  ocrResultId: string,
  resolvedBy: string
): Promise<ReferralOcrResult | null> {
  return updateReferralOcrResult(ocrResultId, {
    resolutionStatus: 'skipped',
    resolvedBy,
  });
}

// Generate a unique MRN for a new patient
export async function generateMrn(): Promise<string> {
  const result = await query<Record<string, unknown>>(
    `SELECT mrn FROM patients ORDER BY created_at DESC LIMIT 1`
  );

  let nextNumber = 1001;
  if (result.rows.length > 0) {
    const lastMrn = result.rows[0].mrn as string;
    const lastNumber = parseInt(lastMrn.replace(/\D/g, ''), 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `MRN${nextNumber.toString().padStart(6, '0')}`;
}
