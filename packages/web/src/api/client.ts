// Barrel file - re-exports from domain modules for backward compatibility
import { authApi } from './auth';
import { patientsApi } from './patients';
import { encountersApi } from './encounters';
import { documentsApi } from './documents';
import { appointmentsApi } from './appointments';
import { ocrApi } from './ocr';
import { referralsApi } from './referrals';
import { calendarApi } from './calendar';
import { tasksApi } from './tasks';

export const api = {
  ...authApi,
  ...patientsApi,
  ...encountersApi,
  ...documentsApi,
  ...appointmentsApi,
  ...ocrApi,
  ...referralsApi,
  ...calendarApi,
  ...tasksApi,
};

// Re-export all types
export type {
  User,
  Patient,
  CreatePatientInput,
  Encounter,
  CreateEncounterInput,
  Document,
  ProcedureTemplate,
  ProcedureTemplateWithContent,
  Appointment,
  AppointmentType,
  CreateAppointmentInput,
  OcrResult,
  OcrFieldMapping,
  ReferralUploadResult,
  PendingReferral,
  ReferralDetail,
  CalendarEvent,
  CreateCalendarEventInput,
  OnCallPeriod,
  CreateOnCallPeriodInput,
  PatientTask,
  CreateTaskInput,
} from './types';

export type { ApiResponse } from './request';
