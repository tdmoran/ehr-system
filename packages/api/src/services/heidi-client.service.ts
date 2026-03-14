import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class HeidiApiError extends Error {
  public readonly statusCode: number;
  public readonly responseBody: string;

  constructor(statusCode: number, responseBody: string) {
    super(`Heidi API error (${statusCode}): ${responseBody}`);
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

interface HeidiSessionResponse {
  sessionId: string;
  sessionUrl: string;
  status: string;
}

interface HeidiTranscriptResponse {
  transcript: string;
  speakers: Array<{ label: string; text: string }>;
  wordCount: number;
  speakerCount: number;
}

interface HeidiNoteResponse {
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

interface HeidiStatusResponse {
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

async function heidiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { heidi } = config;

  if (!heidi.enabled) {
    throw new HeidiApiError(503, 'Heidi integration is disabled');
  }

  if (!heidi.apiBaseUrl || !heidi.apiKey) {
    throw new HeidiApiError(503, 'Heidi API is not configured');
  }

  const url = `${heidi.apiBaseUrl}${path}`;

  logger.info('Heidi API request', { method: options.method || 'GET', path });

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${heidi.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error('Heidi API error', { statusCode: response.status, path, body });
    throw new HeidiApiError(response.status, body);
  }

  return response.json() as Promise<T>;
}

export async function createHeidiSession(
  patientContext: PatientContext
): Promise<HeidiSessionResponse> {
  return heidiRequest<HeidiSessionResponse>('/sessions', {
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
): Promise<HeidiTranscriptResponse> {
  return heidiRequest<HeidiTranscriptResponse>(
    `/sessions/${encodeURIComponent(externalSessionId)}/transcript`
  );
}

export async function generateStructuredNote(
  externalSessionId: string,
  templateType: string = 'soap'
): Promise<HeidiNoteResponse> {
  return heidiRequest<HeidiNoteResponse>(
    `/sessions/${encodeURIComponent(externalSessionId)}/note`,
    {
      method: 'POST',
      body: JSON.stringify({ templateType }),
    }
  );
}

export async function getSuggestedCodes(
  externalSessionId: string
): Promise<{ icdCodes: HeidiNoteResponse['suggestedIcdCodes']; cptCodes: HeidiNoteResponse['suggestedCptCodes'] }> {
  return heidiRequest(
    `/sessions/${encodeURIComponent(externalSessionId)}/codes`
  );
}

export async function getSessionStatus(
  externalSessionId: string
): Promise<HeidiStatusResponse> {
  return heidiRequest<HeidiStatusResponse>(
    `/sessions/${encodeURIComponent(externalSessionId)}/status`
  );
}

export function isHeidiEnabled(): boolean {
  return config.heidi.enabled;
}
