import { request } from './request';
import type { Appointment, AppointmentType, CreateAppointmentInput } from './types';

export const appointmentsApi = {
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
};
