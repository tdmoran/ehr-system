import { request } from './request';
import type { CalendarEvent, CreateCalendarEventInput, OnCallPeriod, CreateOnCallPeriodInput } from './types';

export const calendarApi = {
  getCalendarEvents: (startDate: string, endDate: string, providerId?: string) =>
    request<{ events: CalendarEvent[] }>(
      `/calendar/events?startDate=${startDate}&endDate=${endDate}${providerId ? `&providerId=${providerId}` : ''}`
    ),

  createCalendarEvent: (event: CreateCalendarEventInput) =>
    request<{ event: CalendarEvent }>('/calendar/events', {
      method: 'POST',
      body: JSON.stringify(event),
    }),

  deleteCalendarEvent: (id: string) =>
    request<{ success: boolean }>(`/calendar/events/${id}`, { method: 'DELETE' }),

  getOnCallPeriods: (startDate: string, endDate: string, providerId?: string) =>
    request<{ onCallPeriods: OnCallPeriod[] }>(
      `/calendar/oncall?startDate=${startDate}&endDate=${endDate}${providerId ? `&providerId=${providerId}` : ''}`
    ),

  createOnCallPeriod: (period: CreateOnCallPeriodInput) =>
    request<{ onCallPeriod: OnCallPeriod }>('/calendar/oncall', {
      method: 'POST',
      body: JSON.stringify(period),
    }),

  deleteOnCallPeriod: (id: string) =>
    request<{ success: boolean }>(`/calendar/oncall/${id}`, { method: 'DELETE' }),
};
