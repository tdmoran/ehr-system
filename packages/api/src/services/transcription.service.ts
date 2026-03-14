import { query, withTransaction } from '../db/index.js';
import * as aiTranscriptionClient from './aiTranscription-client.service.js';
import { logger } from '../utils/logger.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TranscriptionSession {
  id: string;
  encounterId: string | null;
  appointmentId: string | null;
  patientId: string;
  providerId: string;
  externalSessionId: string | null;
  externalProvider: 'aiTranscription' | 'built_in';
  status: 'pending' | 'recording' | 'processing' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  durationSeconds: number | null;
  templateUsed: string | null;
  language: string;
  errorMessage: string | null;
}

export interface TranscriptionNote {
  id: string;
  sessionId: string;
  chiefComplaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  fullTranscript: string | null;
  summary: string | null;
  suggestedIcdCodes: unknown[];
  suggestedCptCodes: unknown[];
  confidenceScore: number | null;
  wordCount: number | null;
  speakerCount: number | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  accepted: boolean | null;
  modifications: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptionTemplate {
  id: string;
  providerId: string;
  name: string;
  templateType: string;
  sections: unknown[];
  isDefault: boolean;
  externalTemplateId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptionConsent {
  id: string;
  patientId: string;
  providerId: string;
  sessionId: string | null;
  consentGiven: boolean;
  consentMethod: 'verbal' | 'written' | 'electronic';
  notes: string | null;
  recordedAt: Date;
}

export interface CreateSessionInput {
  patientId: string;
  providerId: string;
  appointmentId?: string;
  templateType?: string;
  language?: string;
}

export interface CreateTemplateInput {
  providerId: string;
  name: string;
  templateType: string;
  sections: unknown[];
  isDefault?: boolean;
}

export interface RecordConsentInput {
  patientId: string;
  providerId: string;
  sessionId?: string;
  consentGiven: boolean;
  consentMethod: 'verbal' | 'written' | 'electronic';
  notes?: string;
}

// ─── Row Mappers ─────────────────────────────────────────────────────────────

function mapSessionRow(row: Record<string, unknown>): TranscriptionSession {
  return {
    id: row.id as string,
    encounterId: row.encounter_id as string | null,
    appointmentId: row.appointment_id as string | null,
    patientId: row.patient_id as string,
    providerId: row.provider_id as string,
    externalSessionId: row.external_session_id as string | null,
    externalProvider: row.external_provider as TranscriptionSession['externalProvider'],
    status: row.status as TranscriptionSession['status'],
    startedAt: row.started_at as Date | null,
    endedAt: row.ended_at as Date | null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    durationSeconds: row.duration_seconds as number | null,
    templateUsed: row.template_used as string | null,
    language: row.language as string,
    errorMessage: row.error_message as string | null,
  };
}

function mapNoteRow(row: Record<string, unknown>): TranscriptionNote {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    chiefComplaint: row.chief_complaint as string | null,
    subjective: row.subjective as string | null,
    objective: row.objective as string | null,
    assessment: row.assessment as string | null,
    plan: row.plan as string | null,
    fullTranscript: row.full_transcript as string | null,
    summary: row.summary as string | null,
    suggestedIcdCodes: (row.suggested_icd_codes as unknown[]) || [],
    suggestedCptCodes: (row.suggested_cpt_codes as unknown[]) || [],
    confidenceScore: row.confidence_score as number | null,
    wordCount: row.word_count as number | null,
    speakerCount: row.speaker_count as number | null,
    reviewedBy: row.reviewed_by as string | null,
    reviewedAt: row.reviewed_at as Date | null,
    accepted: row.accepted as boolean | null,
    modifications: row.modifications as Record<string, unknown> | null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function mapTemplateRow(row: Record<string, unknown>): TranscriptionTemplate {
  return {
    id: row.id as string,
    providerId: row.provider_id as string,
    name: row.name as string,
    templateType: row.template_type as string,
    sections: (row.sections as unknown[]) || [],
    isDefault: row.is_default as boolean,
    externalTemplateId: row.external_template_id as string | null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function mapConsentRow(row: Record<string, unknown>): TranscriptionConsent {
  return {
    id: row.id as string,
    patientId: row.patient_id as string,
    providerId: row.provider_id as string,
    sessionId: row.session_id as string | null,
    consentGiven: row.consent_given as boolean,
    consentMethod: row.consent_method as TranscriptionConsent['consentMethod'],
    notes: row.notes as string | null,
    recordedAt: row.recorded_at as Date,
  };
}

// ─── Session CRUD ────────────────────────────────────────────────────────────

/**
 * Creates a new transcription session for a patient visit.
 *
 * If AITranscription is enabled, initializes an external session via the
 * AITranscription API and stores the external session ID. Falls back to
 * 'built_in' provider when AITranscription is disabled.
 *
 * @param input - Session creation parameters (patientId, providerId, optional appointmentId, templateType, language)
 * @returns The created session and optional external session URL for the AITranscription widget
 * @throws When AITranscription API call fails (if enabled)
 */
export async function createSession(
  input: CreateSessionInput
): Promise<{ session: TranscriptionSession; externalSessionUrl?: string }> {
  const externalProvider = aiTranscriptionClient.isAITranscriptionEnabled() ? 'aiTranscription' : 'built_in';
  let externalSessionId: string | null = null;
  let externalSessionUrl: string | undefined;

  if (externalProvider === 'aiTranscription') {
    try {
      const aiTranscriptionSession = await aiTranscriptionClient.createAITranscriptionSession({
        language: input.language,
        templateType: input.templateType,
      });
      externalSessionId = aiTranscriptionSession.sessionId;
      externalSessionUrl = aiTranscriptionSession.sessionUrl;
    } catch (error) {
      logger.error('Failed to create AITranscription session', { error });
      throw error;
    }
  }

  const result = await query<Record<string, unknown>>(
    `INSERT INTO transcription_sessions (
      patient_id, provider_id, appointment_id, external_session_id,
      external_provider, template_used, language
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      input.patientId,
      input.providerId,
      input.appointmentId || null,
      externalSessionId,
      externalProvider,
      input.templateType || 'soap',
      input.language || 'en',
    ]
  );

  return {
    session: mapSessionRow(result.rows[0]),
    externalSessionUrl,
  };
}

/**
 * Finds a transcription session by its UUID.
 * @returns The session or null if not found
 */
export async function findSessionById(id: string): Promise<TranscriptionSession | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM transcription_sessions WHERE id = $1`,
    [id]
  );
  return result.rows.length > 0 ? mapSessionRow(result.rows[0]) : null;
}

/**
 * Lists all transcription sessions for a patient, ordered by most recent first.
 */
export async function findSessionsByPatientId(patientId: string): Promise<TranscriptionSession[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM transcription_sessions WHERE patient_id = $1 ORDER BY created_at DESC`,
    [patientId]
  );
  return result.rows.map(mapSessionRow);
}

/**
 * Updates the status of a transcription session with automatic timestamp management.
 *
 * - Sets `started_at` when transitioning to 'recording' (only if not already set)
 * - Sets `ended_at` and computes `duration_seconds` on terminal states (completed, failed, cancelled)
 * - Optionally stores an error message for failed sessions
 *
 * @param id - Session UUID
 * @param status - New status value
 * @param errorMessage - Optional error details (for 'failed' status)
 * @returns Updated session or null if not found
 */
export async function updateSessionStatus(
  id: string,
  status: TranscriptionSession['status'],
  errorMessage?: string
): Promise<TranscriptionSession | null> {
  const updates: string[] = ['status = $2', 'updated_at = NOW()'];
  const values: unknown[] = [id, status];
  let paramIndex = 3;

  if (status === 'recording') {
    updates.push(`started_at = COALESCE(started_at, NOW())`);
  }

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    updates.push(`ended_at = NOW()`);
    updates.push(`duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER`);
  }

  if (errorMessage !== undefined) {
    updates.push(`error_message = $${paramIndex}`);
    values.push(errorMessage);
    paramIndex++;
  }

  const result = await query<Record<string, unknown>>(
    `UPDATE transcription_sessions SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );

  return result.rows.length > 0 ? mapSessionRow(result.rows[0]) : null;
}

// ─── Note Operations ─────────────────────────────────────────────────────────

/**
 * Fetches a session along with its most recent generated note.
 * @returns Session and note (null if no note generated yet), or null if session not found
 */
export async function getSessionWithNote(
  sessionId: string
): Promise<{ session: TranscriptionSession; note: TranscriptionNote | null } | null> {
  const session = await findSessionById(sessionId);
  if (!session) return null;

  const noteResult = await query<Record<string, unknown>>(
    `SELECT * FROM transcription_notes WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [sessionId]
  );

  const note = noteResult.rows.length > 0 ? mapNoteRow(noteResult.rows[0]) : null;

  return { session, note };
}

/**
 * Generates a structured clinical note from a transcription session.
 *
 * Calls the AITranscription API to retrieve the transcript and generate a
 * structured note (SOAP fields, summary, ICD/CPT codes). Stores the result
 * in the `transcription_notes` table and marks the session as completed.
 *
 * @param sessionId - Session UUID
 * @param templateType - Note template type (defaults to session's template or 'soap')
 * @returns The generated note
 * @throws When session not found or has no external session ID
 */
export async function generateNote(
  sessionId: string,
  templateType?: string
): Promise<TranscriptionNote> {
  const session = await findSessionById(sessionId);
  if (!session) throw new Error('Session not found');

  if (!session.externalSessionId) {
    throw new Error('No external session ID available for note generation');
  }

  // Call AITranscription API for structured note
  const aiTranscriptionNote = await aiTranscriptionClient.generateStructuredNote(
    session.externalSessionId,
    templateType || session.templateUsed || 'soap'
  );

  // Get transcript
  const transcript = await aiTranscriptionClient.getTranscript(session.externalSessionId);

  // Store the generated note
  const result = await query<Record<string, unknown>>(
    `INSERT INTO transcription_notes (
      session_id, chief_complaint, subjective, objective, assessment, plan,
      full_transcript, summary, suggested_icd_codes, suggested_cpt_codes,
      confidence_score, word_count, speaker_count
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      sessionId,
      aiTranscriptionNote.chiefComplaint,
      aiTranscriptionNote.subjective,
      aiTranscriptionNote.objective,
      aiTranscriptionNote.assessment,
      aiTranscriptionNote.plan,
      transcript.transcript,
      aiTranscriptionNote.summary,
      JSON.stringify(aiTranscriptionNote.suggestedIcdCodes),
      JSON.stringify(aiTranscriptionNote.suggestedCptCodes),
      aiTranscriptionNote.confidenceScore,
      transcript.wordCount,
      transcript.speakerCount,
    ]
  );

  // Update session status to completed
  await updateSessionStatus(sessionId, 'completed');

  return mapNoteRow(result.rows[0]);
}

/**
 * Accepts an AI-generated note and creates or updates an encounter.
 *
 * Runs in a transaction:
 * 1. Marks the note as accepted with reviewer info and any modifications
 * 2. Creates a new encounter or updates an existing one with the SOAP fields
 * 3. Links the encounter to the transcription session
 * 4. Sets `ai_assisted = true` on the encounter
 *
 * @param sessionId - Session UUID
 * @param reviewerId - UUID of the reviewing clinician
 * @param modifications - Optional field overrides from clinician edits
 * @param encounterId - Optional existing encounter UUID to update instead of creating new
 * @returns The created or updated encounter
 */
export async function acceptNote(
  sessionId: string,
  reviewerId: string,
  modifications?: Record<string, unknown>,
  encounterId?: string
): Promise<{ encounter: Record<string, unknown> }> {
  return withTransaction(async (client) => {
    // Mark note as accepted
    const noteResult = await client.query(
      `UPDATE transcription_notes
       SET reviewed_by = $1, reviewed_at = NOW(), accepted = TRUE,
           modifications = $3, updated_at = NOW()
       WHERE session_id = $2
       ORDER BY created_at DESC LIMIT 1
       RETURNING *`,
      [reviewerId, sessionId, modifications ? JSON.stringify(modifications) : null]
    );

    if (noteResult.rows.length === 0) {
      throw new Error('No note found for this session');
    }

    const note = mapNoteRow(noteResult.rows[0]);

    // Use modifications if provided, otherwise use AI-generated fields
    const chiefComplaint = modifications?.chiefComplaint ?? note.chiefComplaint;
    const subjective = modifications?.subjective ?? note.subjective;
    const objective = modifications?.objective ?? note.objective;
    const assessment = modifications?.assessment ?? note.assessment;
    const plan = modifications?.plan ?? note.plan;

    const session = await findSessionById(sessionId);
    if (!session) throw new Error('Session not found');

    let encounterResult;

    if (encounterId) {
      // Update existing encounter
      encounterResult = await client.query(
        `UPDATE encounters
         SET chief_complaint = $2, subjective = $3, objective = $4,
             assessment = $5, plan = $6, transcription_session_id = $7,
             ai_assisted = TRUE, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [encounterId, chiefComplaint, subjective, objective, assessment, plan, sessionId]
      );
    } else {
      // Create new encounter
      encounterResult = await client.query(
        `INSERT INTO encounters (
           patient_id, provider_id, encounter_date, chief_complaint,
           subjective, objective, assessment, plan,
           transcription_session_id, ai_assisted
         ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, TRUE)
         RETURNING *`,
        [
          session.patientId,
          session.providerId,
          chiefComplaint,
          subjective,
          objective,
          assessment,
          plan,
          sessionId,
        ]
      );
    }

    // Link encounter to session
    const encounter = encounterResult.rows[0];
    await client.query(
      `UPDATE transcription_sessions SET encounter_id = $1, updated_at = NOW() WHERE id = $2`,
      [encounter.id, sessionId]
    );

    return { encounter };
  });
}

/**
 * Rejects an AI-generated note. The clinician will write the encounter manually.
 * Marks the note as reviewed but not accepted.
 */
export async function rejectNote(
  sessionId: string,
  reviewerId: string
): Promise<void> {
  await query(
    `UPDATE transcription_notes
     SET reviewed_by = $1, reviewed_at = NOW(), accepted = FALSE, updated_at = NOW()
     WHERE session_id = $2`,
    [reviewerId, sessionId]
  );
}

/**
 * Retrieves suggested ICD-10 and CPT codes for a session.
 *
 * First checks for codes already stored in the note. If none found,
 * falls back to querying the AITranscription API directly.
 *
 * @returns Object with `icdCodes` and `cptCodes` arrays
 */
export async function getSuggestedCodes(
  sessionId: string
): Promise<{ icdCodes: unknown[]; cptCodes: unknown[] }> {
  const session = await findSessionById(sessionId);
  if (!session) throw new Error('Session not found');

  // First check if we already have codes in the note
  const noteResult = await query<Record<string, unknown>>(
    `SELECT suggested_icd_codes, suggested_cpt_codes FROM transcription_notes
     WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [sessionId]
  );

  if (noteResult.rows.length > 0) {
    return {
      icdCodes: (noteResult.rows[0].suggested_icd_codes as unknown[]) || [],
      cptCodes: (noteResult.rows[0].suggested_cpt_codes as unknown[]) || [],
    };
  }

  // Fall back to AITranscription API if no stored codes
  if (session.externalSessionId) {
    return aiTranscriptionClient.getSuggestedCodes(session.externalSessionId);
  }

  return { icdCodes: [], cptCodes: [] };
}

// ─── Note Update ────────────────────────────────────────────────────────────

export interface UpdateNoteInput {
  chiefComplaint?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  summary?: string;
  reviewStatus?: 'draft' | 'finalized';
}

/**
 * Updates specific fields of a transcription note (draft save).
 * Only the provided fields are updated; others are preserved.
 *
 * @param sessionId - Session UUID (finds the most recent note for this session)
 * @param input - Fields to update
 * @returns The updated note
 * @throws When no note exists for the session
 */
export async function updateNote(
  sessionId: string,
  input: UpdateNoteInput
): Promise<TranscriptionNote> {
  // Find existing note for this session
  const existing = await query<Record<string, unknown>>(
    `SELECT id FROM transcription_notes WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [sessionId]
  );

  if (existing.rows.length === 0) {
    throw new Error('No note found for this session');
  }

  const noteId = existing.rows[0].id as string;

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (input.chiefComplaint !== undefined) {
    setClauses.push(`chief_complaint = $${paramIdx++}`);
    values.push(input.chiefComplaint);
  }
  if (input.subjective !== undefined) {
    setClauses.push(`subjective = $${paramIdx++}`);
    values.push(input.subjective);
  }
  if (input.objective !== undefined) {
    setClauses.push(`objective = $${paramIdx++}`);
    values.push(input.objective);
  }
  if (input.assessment !== undefined) {
    setClauses.push(`assessment = $${paramIdx++}`);
    values.push(input.assessment);
  }
  if (input.plan !== undefined) {
    setClauses.push(`plan = $${paramIdx++}`);
    values.push(input.plan);
  }
  if (input.summary !== undefined) {
    setClauses.push(`summary = $${paramIdx++}`);
    values.push(input.summary);
  }

  setClauses.push(`updated_at = NOW()`);

  if (setClauses.length === 1) {
    // Only updated_at, no actual changes
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM transcription_notes WHERE id = $1`,
      [noteId]
    );
    return mapNoteRow(result.rows[0]);
  }

  values.push(noteId);
  const result = await query<Record<string, unknown>>(
    `UPDATE transcription_notes SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    values
  );

  return mapNoteRow(result.rows[0]);
}

// ─── Template CRUD ───────────────────────────────────────────────────────────

/** Lists all templates for a provider, with defaults first, then alphabetical. */
export async function findTemplatesByProviderId(providerId: string): Promise<TranscriptionTemplate[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM transcription_templates WHERE provider_id = $1 ORDER BY is_default DESC, name ASC`,
    [providerId]
  );
  return result.rows.map(mapTemplateRow);
}

/** Finds a template by UUID. Returns null if not found. */
export async function findTemplateById(id: string): Promise<TranscriptionTemplate | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM transcription_templates WHERE id = $1`,
    [id]
  );
  return result.rows.length > 0 ? mapTemplateRow(result.rows[0]) : null;
}

/**
 * Creates a new note template for a provider.
 * If `isDefault` is true, unsets the default flag on all other templates for this provider.
 */
export async function createTemplate(input: CreateTemplateInput): Promise<TranscriptionTemplate> {
  // If setting as default, unset other defaults for this provider
  if (input.isDefault) {
    await query(
      `UPDATE transcription_templates SET is_default = FALSE WHERE provider_id = $1`,
      [input.providerId]
    );
  }

  const result = await query<Record<string, unknown>>(
    `INSERT INTO transcription_templates (provider_id, name, template_type, sections, is_default)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.providerId,
      input.name,
      input.templateType,
      JSON.stringify(input.sections),
      input.isDefault || false,
    ]
  );

  return mapTemplateRow(result.rows[0]);
}

/** Updates a template's fields. Only provided fields are changed. */
export async function updateTemplate(
  id: string,
  input: Partial<Omit<CreateTemplateInput, 'providerId'>>
): Promise<TranscriptionTemplate | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  const fieldMap: Record<string, string> = {
    name: 'name',
    templateType: 'template_type',
    isDefault: 'is_default',
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (key in input) {
      fields.push(`${dbField} = $${paramIndex}`);
      values.push(input[key as keyof typeof input]);
      paramIndex++;
    }
  }

  if (input.sections !== undefined) {
    fields.push(`sections = $${paramIndex}`);
    values.push(JSON.stringify(input.sections));
    paramIndex++;
  }

  if (fields.length === 0) return findTemplateById(id);

  fields.push('updated_at = NOW()');
  values.push(id);

  const result = await query<Record<string, unknown>>(
    `UPDATE transcription_templates SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return result.rows.length > 0 ? mapTemplateRow(result.rows[0]) : null;
}

/** Deletes a template by UUID. Returns true if a row was deleted. */
export async function deleteTemplate(id: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM transcription_templates WHERE id = $1`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Consent CRUD ────────────────────────────────────────────────────────────

/**
 * Records a patient's consent (or refusal) for AI transcription.
 * Consent records are immutable -- new records are created for changes, never updated.
 */
export async function recordConsent(input: RecordConsentInput): Promise<TranscriptionConsent> {
  const result = await query<Record<string, unknown>>(
    `INSERT INTO transcription_consents (patient_id, provider_id, session_id, consent_given, consent_method, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.patientId,
      input.providerId,
      input.sessionId || null,
      input.consentGiven,
      input.consentMethod,
      input.notes || null,
    ]
  );

  return mapConsentRow(result.rows[0]);
}

/** Lists all consent records for a patient, ordered by most recent first. */
export async function findConsentsByPatientId(patientId: string): Promise<TranscriptionConsent[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM transcription_consents WHERE patient_id = $1 ORDER BY recorded_at DESC`,
    [patientId]
  );
  return result.rows.map(mapConsentRow);
}
