import { request } from './request';
import type { Encounter, CreateEncounterInput } from './types';

export const encountersApi = {
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
};
