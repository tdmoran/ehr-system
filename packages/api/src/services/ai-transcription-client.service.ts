import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/** Custom error class for AITranscription API failures, preserving the HTTP status code and response body. */
export class AITranscriptionApiError extends Error {
  public readonly statusCode: number;
  public readonly responseBody: string;

  constructor(statusCode: number, responseBody: string) {
    super(`AITranscription API error (${statusCode}): ${responseBody}`);
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

interface AITranscriptionSessionResponse {
  sessionId: string;
  sessionUrl: string;
  status: string;
}

interface AITranscriptionTranscriptResponse {
  transcript: string;
  speakers: Array<{ label: string; text: string }>;
  wordCount: number;
  speakerCount: number;
}

interface AITranscriptionNoteResponse {
  chiefComplaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  summary: string | null;
  confidenceScore: number;
  suggestedIcdCodes: Array<{ code: string; description: string; confidence: number }>;
  suggestedCptCodes: Array<{ code: string; description: string; confidence: number }>;
}

interface AITranscriptionStatusResponse {
  sessionId: string;
  status: string;
  error?: string;
}

interface PatientContext {
  patientName?: string;
  dateOfBirth?: string;
  language?: string;
  templateType?: string;
}

/**
 * Internal helper to make authenticated requests to the AITranscription API.
 * Validates that the feature is enabled and configured before making any request.
 * @throws {AITranscriptionApiError} On non-OK responses, disabled state, or missing config
 */
async function aiTranscriptionRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { aiTranscription } = config;

  if (!aiTranscription.enabled) {
    throw new AITranscriptionApiError(503, 'AITranscription integration is disabled');
  }

  if (!aiTranscription.apiBaseUrl || !aiTranscription.apiKey) {
    throw new AITranscriptionApiError(503, 'AITranscription API is not configured');
  }

  const url = `${aiTranscription.apiBaseUrl}${path}`;

  logger.info('AITranscription API request', { method: options.method || 'GET', path });

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${aiTranscription.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error('AITranscription API error', { statusCode: response.status, path, body });
    throw new AITranscriptionApiError(response.status, body);
  }

  return response.json() as Promise<T>;
}

/**
 * Creates a new transcription session on the AITranscription API.
 * @param patientContext - Optional patient context for speaker identification
 * @returns Session ID and URL for the AITranscription widget
 */
export async function createAITranscriptionSession(
  patientContext: PatientContext
): Promise<AITranscriptionSessionResponse> {
  return aiTranscriptionRequest<AITranscriptionSessionResponse>('/sessions', {
    method: 'POST',
    body: JSON.stringify({
      patientName: patientContext.patientName,
      dateOfBirth: patientContext.dateOfBirth,
      language: patientContext.language || 'en',
      templateType: patientContext.templateType || 'soap',
    }),
  });
}

/**
 * Retrieves the raw transcript for a completed session, including speaker labels and word count.
 */
export async function getTranscript(
  externalSessionId: string
): Promise<AITranscriptionTranscriptResponse> {
  return aiTranscriptionRequest<AITranscriptionTranscriptResponse>(
    `/sessions/${encodeURIComponent(externalSessionId)}/transcript`
  );
}

/**
 * Generates a structured clinical note from a transcription session.
 * Returns SOAP fields, summary, confidence score, and suggested ICD/CPT codes.
 */
export async function generateStructuredNote(
  externalSessionId: string,
  templateType: string = 'soap'
): Promise<AITranscriptionNoteResponse> {
  return aiTranscriptionRequest<AITranscriptionNoteResponse>(
    `/sessions/${encodeURIComponent(externalSessionId)}/note`,
    {
      method: 'POST',
      body: JSON.stringify({ templateType }),
    }
  );
}

/** Retrieves AI-suggested ICD-10 and CPT codes for a session. */
export async function getSuggestedCodes(
  externalSessionId: string
): Promise<{ icdCodes: AITranscriptionNoteResponse['suggestedIcdCodes']; cptCodes: AITranscriptionNoteResponse['suggestedCptCodes'] }> {
  return aiTranscriptionRequest(
    `/sessions/${encodeURIComponent(externalSessionId)}/codes`
  );
}

/** Polls the processing status of an AITranscription session. */
export async function getSessionStatus(
  externalSessionId: string
): Promise<AITranscriptionStatusResponse> {
  return aiTranscriptionRequest<AITranscriptionStatusResponse>(
    `/sessions/${encodeURIComponent(externalSessionId)}/status`
  );
}

/** Returns whether the AITranscription integration is enabled via the HEIDI_ENABLED feature flag. */
export function isAITranscriptionEnabled(): boolean {
  return config.aiTranscription.enabled;
}
