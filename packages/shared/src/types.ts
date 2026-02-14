// User types
export type UserRole = 'provider' | 'nurse' | 'admin' | 'billing' | 'secretary';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  providerId?: string;
}

// Patient types
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
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  insuranceProvider: string | null;
  insuranceId: string | null;
  notes: string | null;
  clinicNotes: string | null;
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
  notes?: string;
  clinicNotes?: string;
}

// Encounter types
export type EncounterStatus = 'in_progress' | 'completed' | 'signed';

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
  status: EncounterStatus;
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

// Allergy types
export type AllergySeverity = 'mild' | 'moderate' | 'severe';

export interface Allergy {
  id: string;
  patientId: string;
  allergen: string;
  reaction: string | null;
  severity: AllergySeverity | null;
}

// Document types
export interface Document {
  id: string;
  patientId: string;
  uploadedBy: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  description: string | null;
  category: 'scanned_document' | 'letter' | 'operative_note';
  createdAt: string;
}

export interface ProcedureTemplate {
  id: string;
  name: string;
  filename: string;
  description: string;
  category: string;
}

export interface ProcedureTemplateWithContent extends ProcedureTemplate {
  content: string;
}

// Appointment types
export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  reason: string | null;
  status: AppointmentStatus;
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

// OCR types
export type OcrProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type OcrDocumentType = 'referral' | 'lab_result' | 'intake_form' | 'unknown';
export type OcrFieldStatus = 'pending' | 'applied' | 'rejected';

export interface OcrResult {
  id: string;
  documentId: string;
  rawText: string | null;
  confidenceScore: number | null;
  documentType: OcrDocumentType | null;
  extractedData: Record<string, unknown> | null;
  processingStatus: OcrProcessingStatus;
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
  status: OcrFieldStatus;
  appliedAt: string | null;
  appliedBy: string | null;
  createdAt: string;
}

// Referral types
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

// Calendar types
export interface CalendarEvent {
  id: string;
  providerId: string;
  date: string;
  title: string;
  notes: string | null;
  createdAt: string;
}

export interface CreateCalendarEventInput {
  eventDate: string;
  title: string;
  notes?: string;
}

export interface OnCallPeriod {
  id: string;
  providerId: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  createdAt: string;
}

export interface CreateOnCallPeriodInput {
  startDate: string;
  endDate: string;
  notes?: string;
}

// Task types
export interface PatientTask {
  id: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  text: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
}

export interface CreateTaskInput {
  patientId: string;
  taskText: string;
}

// API types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
  details?: Array<{ field: string; message: string }>;
}
