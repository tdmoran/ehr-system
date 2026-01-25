const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_URL}/api${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle validation errors with details
      if (data.details && Array.isArray(data.details)) {
        const detailMessages = data.details
          .map((d: { field: string; message: string }) => `${d.field}: ${d.message}`)
          .join(', ');
        return { error: `${data.error || 'Validation failed'}: ${detailMessages}` };
      }
      return { error: data.error || 'An error occurred' };
    }

    return { data };
  } catch (error) {
    return { error: 'Network error. Please try again.' };
  }
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request<User>('/auth/me'),

  logout: () => request('/auth/logout', { method: 'POST' }),

  // Patients
  getPatients: (search?: string) =>
    request<{ patients: Patient[] }>(`/patients${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  getPatient: (id: string) => request<{ patient: Patient }>(`/patients/${id}`),

  createPatient: (patient: CreatePatientInput) =>
    request<{ patient: Patient }>('/patients', {
      method: 'POST',
      body: JSON.stringify(patient),
    }),

  updatePatient: (id: string, patient: Partial<CreatePatientInput>) =>
    request<{ patient: Patient }>(`/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patient),
    }),

  // Encounters
  getPatientEncounters: (patientId: string) =>
    request<{ encounters: Encounter[] }>(`/encounters/patient/${patientId}`),

  getEncounter: (id: string) => request<{ encounter: Encounter }>(`/encounters/${id}`),

  createEncounter: (encounter: CreateEncounterInput) =>
    request<{ encounter: Encounter }>('/encounters', {
      method: 'POST',
      body: JSON.stringify(encounter),
    }),

  updateEncounter: (id: string, encounter: Partial<CreateEncounterInput>) =>
    request<{ encounter: Encounter }>(`/encounters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(encounter),
    }),

  signEncounter: (id: string) =>
    request<{ encounter: Encounter }>(`/encounters/${id}/sign`, { method: 'POST' }),

  // Documents
  getPatientDocuments: (patientId: string) =>
    request<{ documents: Document[] }>(`/documents/patient/${patientId}`),

  uploadDocument: async (patientId: string, file: File, description?: string): Promise<ApiResponse<{ document: Document }>> => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }

    try {
      const response = await fetch(`${API_URL}/api/documents/patient/${patientId}`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Upload failed' };
      }

      return { data };
    } catch (error) {
      return { error: 'Network error. Please try again.' };
    }
  },

  getDocumentUrl: (documentId: string) => `${API_URL}/api/documents/${documentId}/download`,

  deleteDocument: (id: string) =>
    request<{ message: string }>(`/documents/${id}`, { method: 'DELETE' }),

  // Appointments
  getAppointments: (startDate: string, endDate: string, providerId?: string) =>
    request<{ appointments: Appointment[] }>(
      `/appointments?startDate=${startDate}&endDate=${endDate}${providerId ? `&providerId=${providerId}` : ''}`
    ),

  getAppointment: (id: string) =>
    request<{ appointment: Appointment }>(`/appointments/${id}`),

  createAppointment: (appointment: CreateAppointmentInput) =>
    request<{ appointment: Appointment }>('/appointments', {
      method: 'POST',
      body: JSON.stringify(appointment),
    }),

  updateAppointment: (id: string, appointment: Partial<CreateAppointmentInput> & { status?: string }) =>
    request<{ appointment: Appointment }>(`/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(appointment),
    }),

  deleteAppointment: (id: string) =>
    request<{ message: string }>(`/appointments/${id}`, { method: 'DELETE' }),

  getAppointmentTypes: () =>
    request<{ types: AppointmentType[] }>('/appointments/config/types'),

  getProviders: () =>
    request<{ providers: { id: string; firstName: string; lastName: string }[] }>('/appointments/config/providers'),

  createBulkAppointments: (appointments: CreateAppointmentInput[]) =>
    request<{ appointments: Appointment[]; errors: { index: number; error: string }[] }>('/appointments/bulk', {
      method: 'POST',
      body: JSON.stringify({ appointments }),
    }),

  // OCR
  processDocumentOcr: (documentId: string) =>
    request<{ message: string; ocrResultId: string; status: string }>(`/ocr/documents/${documentId}/process`, {
      method: 'POST',
    }),

  getOcrResult: (documentId: string) =>
    request<{ ocrResult: OcrResult }>(`/ocr/documents/${documentId}/result`),

  getExtractedFields: (documentId: string) =>
    request<{ ocrResult: OcrResult; fieldMappings: OcrFieldMapping[] }>(`/ocr/documents/${documentId}/extracted-fields`),

  applyOcrFields: (documentId: string, fieldIds: string[]) =>
    request<{ message: string; updatedFields: string[]; patient: Patient }>(`/ocr/documents/${documentId}/apply-fields`, {
      method: 'POST',
      body: JSON.stringify({ fieldIds }),
    }),

  rejectOcrFields: (documentId: string, fieldIds: string[]) =>
    request<{ message: string; rejectedCount: number }>(`/ocr/documents/${documentId}/reject-fields`, {
      method: 'POST',
      body: JSON.stringify({ fieldIds }),
    }),

  // Referrals
  uploadReferralScans: async (files: File[]): Promise<ApiResponse<{ message: string; referrals: ReferralUploadResult[] }>> => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`${API_URL}/api/referrals/scan`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Upload failed' };
      }

      return { data };
    } catch (error) {
      return { error: 'Network error. Please try again.' };
    }
  },

  getPendingReferrals: () =>
    request<{ referrals: PendingReferral[] }>('/referrals/pending'),

  getReferral: (id: string) =>
    request<{ referral: ReferralDetail }>(`/referrals/${id}`),

  createPatientFromReferral: (id: string, patientData: CreatePatientInput) =>
    request<{ message: string; patient: Patient }>(`/referrals/${id}/create-patient`, {
      method: 'POST',
      body: JSON.stringify(patientData),
    }),

  addReferralToPatient: (id: string, data: { patientId: string; referringPhysician?: string; referringFacility?: string; reasonForReferral?: string }) =>
    request<{ message: string; patient: Patient }>(`/referrals/${id}/add-to-patient`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  skipReferral: (id: string) =>
    request<{ message: string }>(`/referrals/${id}/skip`, {
      method: 'POST',
    }),

  getReferralFileUrl: (id: string) => `${API_URL}/api/referrals/${id}/download`,
};

// Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'provider' | 'nurse' | 'admin' | 'billing' | 'secretary';
  providerId?: string;
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  insuranceProvider: string | null;
  active: boolean;
}

export interface CreatePatientInput {
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  insuranceProvider?: string;
  insuranceId?: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  providerId: string;
  encounterDate: string;
  chiefComplaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  status: 'in_progress' | 'completed' | 'signed';
  signedAt: string | null;
}

export interface CreateEncounterInput {
  patientId: string;
  chiefComplaint?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface Document {
  id: string;
  patientId: string;
  uploadedBy: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  description: string | null;
  createdAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  reason: string | null;
  status: 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
  createdBy: string;
  createdAt: string;
  patientFirstName?: string;
  patientLastName?: string;
  patientMrn?: string;
  providerFirstName?: string;
  providerLastName?: string;
}

export interface AppointmentType {
  id: string;
  name: string;
  durationMinutes: number;
  color: string;
}

export interface CreateAppointmentInput {
  patientId: string;
  providerId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  reason?: string;
  notes?: string;
}

// OCR Types
export interface OcrResult {
  id: string;
  documentId: string;
  rawText: string | null;
  confidenceScore: number | null;
  documentType: 'referral' | 'lab_result' | 'intake_form' | 'unknown' | null;
  extractedData: Record<string, unknown> | null;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage: string | null;
  processedAt: string | null;
  createdAt: string;
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
  appliedAt: string | null;
  appliedBy: string | null;
  createdAt: string;
}

// Referral Types
export interface ReferralUploadResult {
  id: string;
  filename: string;
  status: string;
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
  createdAt: string;
}

export interface ReferralDetail {
  id: string;
  referralScanId: string;
  rawText: string | null;
  confidenceScore: number | null;
  extractedData: Record<string, unknown> | null;
  patientFirstName: string | null;
  patientLastName: string | null;
  patientDob: string | null;
  patientPhone: string | null;
  referringPhysician: string | null;
  referringFacility: string | null;
  reasonForReferral: string | null;
  matchedPatientId: string | null;
  matchConfidence: number | null;
  resolutionStatus: string;
  resolvedPatientId: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  processedAt: string | null;
  createdAt: string;
  scan: {
    id: string;
    filename: string;
    originalName: string;
    mimeType: string | null;
    fileSize: number | null;
    processingStatus: string;
  };
}
