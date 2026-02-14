import { API_URL } from './request';
import type { ApiResponse } from './request';
import { request } from './request';
import type { Patient, CreatePatientInput, ReferralUploadResult, PendingReferral, ReferralDetail } from './types';

export const referralsApi = {
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
