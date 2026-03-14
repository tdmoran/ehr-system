import { request, API_URL } from './request';
import type {
  TranscriptionConsent,
  RecordConsentInput,
} from '@ehr/shared';

// ─── Types (local until shared package is updated) ──────────────────────────

export type TranscriptionStatus =
  | 'pending'
  | 'recording'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TranscriptionSession {
  id: string;
  encounterId: string | null;
  appointmentId: string | null;
  patientId: string;
  providerId: string;
  externalSessionId: string | null;
  externalProvider: 'heidi' | 'built_in';
  status: TranscriptionStatus;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  templateUsed: string | null;
  language: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields from list queries
  patientFirstName?: string;
  patientLastName?: string;
  patientDob?: string;
  providerName?: string;
}

export interface TranscriptionListParams {
  status?: TranscriptionStatus;
  patientSearch?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'status' | 'durationSeconds';
  sortOrder?: 'asc' | 'desc';
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
  suggestedIcdCodes: SuggestedCode[];
  suggestedCptCodes: SuggestedCode[];
  confidenceScore: number | null;
  wordCount: number | null;
  speakerCount: number | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  accepted: boolean | null;
  modifications: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestedCode {
  code: string;
  description: string;
  confidence: number;
}

export interface CreateSessionInput {
  patientId: string;
  appointmentId?: string;
  templateType?: string;
  language?: string;
}

// ─── API Client ─────────────────────────────────────────────────────────────

export const transcriptionsApi = {
  getSessions: (params: TranscriptionListParams = {}) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.patientSearch) searchParams.set('patientSearch', params.patientSearch);
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);
    if (params.page !== undefined) searchParams.set('page', String(params.page));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

    const qs = searchParams.toString();
    return request<{
      sessions: TranscriptionSession[];
      total: number;
      page: number;
      limit: number;
    }>(`/transcriptions/sessions${qs ? `?${qs}` : ''}`);
  },

  createSession: (data: CreateSessionInput) =>
    request<{ session: TranscriptionSession; externalSessionUrl?: string }>(
      '/transcriptions/sessions',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  getSession: (id: string) =>
    request<{ session: TranscriptionSession; note?: TranscriptionNote }>(
      `/transcriptions/sessions/${id}`
    ),

  updateSessionStatus: (id: string, status: string) =>
    request<{ session: TranscriptionSession }>(
      `/transcriptions/sessions/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) }
    ),

  getPatientSessions: (patientId: string) =>
    request<{ sessions: TranscriptionSession[] }>(
      `/transcriptions/sessions/patient/${patientId}`
    ),

  generateNote: (id: string, templateType?: string) =>
    request<{ note: TranscriptionNote }>(
      `/transcriptions/sessions/${id}/generate`,
      { method: 'POST', body: JSON.stringify({ templateType }) }
    ),

  acceptNote: (id: string, data: { modifications?: Record<string, unknown>; encounterId?: string }) =>
    request<{ encounter: unknown }>(
      `/transcriptions/sessions/${id}/accept`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  rejectNote: (id: string) =>
    request<{ message: string }>(
      `/transcriptions/sessions/${id}/reject`,
      { method: 'POST' }
    ),

  getSuggestedCodes: (id: string) =>
    request<{ icdCodes: SuggestedCode[]; cptCodes: SuggestedCode[] }>(
      `/transcriptions/sessions/${id}/codes`
    ),

  updateNote: (sessionId: string, data: {
    chiefComplaint?: string;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    summary?: string;
    reviewStatus?: 'draft' | 'finalized';
  }) =>
    request<{ note: TranscriptionNote }>(
      `/transcriptions/sessions/${sessionId}/note`,
      { method: 'PUT', body: JSON.stringify(data) }
    ),

  deleteSession: (id: string) =>
    request<void>(`/transcriptions/sessions/${id}`, { method: 'DELETE' }),

  // ─── Consent ────────────────────────────────────────────────────────────────

  recordConsent: (data: RecordConsentInput) =>
    request<{ consent: TranscriptionConsent }>(
      '/transcriptions/consent',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  getPatientConsents: (patientId: string) =>
    request<{ consents: TranscriptionConsent[] }>(
      `/transcriptions/consent/patient/${patientId}`
    ),

  /** Upload an audio chunk to the session endpoint */
  uploadAudioChunk: async (sessionId: string, audioBlob: Blob): Promise<{ error?: string }> => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('audio', audioBlob, 'chunk.webm');

    try {
      const response = await fetch(
        `${API_URL}/api/transcriptions/${sessionId}/audio`,
        {
          method: 'POST',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        }
      );
      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || 'Failed to upload audio' };
      }
      return {};
    } catch {
      return { error: 'Network error uploading audio' };
    }
  },
};
