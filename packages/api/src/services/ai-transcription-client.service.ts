import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

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

export async function getTranscript(
  externalSessionId: string
): Promise<AITranscriptionTranscriptResponse> {
  return aiTranscriptionRequest<AITranscriptionTranscriptResponse>(
    `/sessions/${encodeURIComponent(externalSessionId)}/transcript`
  );
}

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

export async function getSuggestedCodes(
  externalSessionId: string
): Promise<{ icdCodes: AITranscriptionNoteResponse['suggestedIcdCodes']; cptCodes: AITranscriptionNoteResponse['suggestedCptCodes'] }> {
  return aiTranscriptionRequest(
    `/sessions/${encodeURIComponent(externalSessionId)}/codes`
  );
}

export async function getSessionStatus(
  externalSessionId: string
): Promise<AITranscriptionStatusResponse> {
  return aiTranscriptionRequest<AITranscriptionStatusResponse>(
    `/sessions/${encodeURIComponent(externalSessionId)}/status`
  );
}

export function isAITranscriptionEnabled(): boolean {
  return config.aiTranscription.enabled;
}
