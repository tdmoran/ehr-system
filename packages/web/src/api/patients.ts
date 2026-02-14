import { request } from './request';
import type { Patient, CreatePatientInput } from './types';

export const patientsApi = {
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
};
