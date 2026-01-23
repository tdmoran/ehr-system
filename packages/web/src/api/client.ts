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
};

// Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'provider' | 'nurse' | 'admin' | 'billing';
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
